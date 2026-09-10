#!/usr/bin/env python3
"""Fit brush strokes to a Van Gogh scan.

M0a was one tile, luminance only, to answer whether a field of fitted ribbons
reads as paint. It does. M0b is the pipeline behind that answer: the whole
canvas, tiled with a merge across the overlaps; ridges on luminance *and* on
both chroma channels, because a slab of one loaded colour beside another at the
same value is invisible to a luminance ridge and was 11% of the gate tile; a
residual underlayer, so the unfinished states look like an unfinished painting
rather than a loading bar; the scan's colour profile honoured or its absence
recorded; and the edge of the painting found rather than assumed.

Two things are calibrated once for the whole canvas rather than per tile, and
both are seam mechanisms if they are not. The seed strength threshold: a
per-tile percentile means a tile of sky and a tile of wheat disagree about what
counts as a stroke, and the disagreement lands exactly on the boundary between
them. The wide blur under the height estimate: sigma is 140 px, so a tile
computing it alone invents 420 px in from each of its own edges.

The height field is still DESIGN 4.1 step 6's luminance-above-a-neighbourhood
estimate, which BUILD.md M1 says is measuring colour rather than relief. It is
flagged as method 0 in the blob and M1 replaces it.

Every number lives in params/<slug>.json. Nothing is tuned by editing this file.

    tools/extract.py reaper                  # the whole canvas, tiled
    tools/extract.py reaper --tile gate      # one named region, for tuning
"""
import argparse, hashlib, io, json, os, resource, sys, time
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates, maximum_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import relief

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
EPS = 1e-12
DS = 8                      # downsample for the canvas-wide low-frequency work

# Every key params/<slug>.json may contain. make.py checks a params file against
# this, both ways: a key here that the file lacks is a missing number, and a key
# in the file that is not here is a number that silently does nothing -- which
# is the more expensive of the two, because it looks like it is tuning.
PARAMS = (
    "slug source canvas_cm px_per_cm tiles tile "
    "sigma_grad sigma_tensor sigma_ridge sigma_height sigma_relief height_mm "
    "relief_width_pow relief_stack_w relief_floor relief_sym_w order_lift_mm "
    "chroma_gain chroma_tensor_w chroma_priority chroma_veto_px "
    "tensor_energy_frac "
    "seed_spacing seed_strength_pct coherence_min "
    "step max_arc min_arc max_turn max_total_turn dir_blend de_max recentre "
    "width_min width_max width_drop_frac width_gap_frac trough_chroma_min "
    "colour_band dedup_frac dedup_angle dedup_band fit_tol_frac fit_max_split "
    "tile_px tile_step sigma_under under_ds"
).split()


# ---------------------------------------------------------------- colour ----

def srgb_to_linear(a):
    """sRGB 0..255 -> linear 0..1. The input is *bytes*, not a 0..1 fraction.

    Written this way because every caller inside this file hands it a scan, and
    it stayed that way through M3 without saying so. Three callers outside had
    divided by 255 first, which lands every value under the sRGB toe, makes the
    whole transfer curve linear and quietly turns Lab into a linear map of sRGB.
    M4 found it in place.py and order.py and it is recorded there.
    """
    a = a.astype(np.float32) / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def linear_to_lab(rgb):
    """Linear sRGB -> CIE Lab (D65)."""
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]], np.float32)
    xyz = rgb @ m.T
    xyz /= np.array([0.95047, 1.0, 1.08883], np.float32)
    d = 6.0 / 29.0
    f = np.where(xyz > d ** 3, np.cbrt(np.maximum(xyz, EPS)),
                 xyz / (3 * d * d) + 4.0 / 29.0)
    return np.stack([116 * f[..., 1] - 16,
                     500 * (f[..., 0] - f[..., 1]),
                     200 * (f[..., 1] - f[..., 2])], -1).astype(np.float32)


def lightness(lin):
    """Perceptual lightness of a linear-RGB image, 0..1. Ridges are visual."""
    y = 0.2126729 * lin[..., 0] + 0.7151522 * lin[..., 1] + 0.0721750 * lin[..., 2]
    return np.power(np.maximum(y, 0.0), 1.0 / 2.4).astype(np.float32)


def decode(path, min_width=0):
    """Open a scan and get it to sRGB, honouring its profile if it has one.

    DESIGN 4.1 step 1. BUILD.md makes this a cross-station problem rather than a
    per-canvas one: forty scans from twelve institutions, and if the decode is
    loose the stations do not sit on the same colour footing. Station 2's flood
    is the effect most exposed to it. So the rule is honour what is embedded and
    *record the absence* where there is nothing to honour, rather than assuming
    sRGB silently -- 31 of these 40 files have no profile at all, including both
    sides of that flood.
    """
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    # A JPEG can be decoded straight out of the DCT at a half, a quarter or an
    # eighth, which is what makes a 1.6 gigapixel scan openable at all: the
    # Starry Night is 44,567 px wide and 4.7 GB decoded whole. The rule is that
    # this must never become the resampler -- ask for at least twice the
    # working width, so the LANCZOS step below is still a downsample by two and
    # the coefficient truncation stays a factor of two away from the output.
    # Every scan in this set but that one is already inside 2x and reduces by
    # nothing, which is why no golden moves.
    if min_width and im.size[0] > 2 * min_width:
        w2 = 2 * min_width
        im.draft("RGB", (w2, round(im.size[1] * w2 / im.size[0])))
    icc = im.info.get("icc_profile")
    if im.mode != "RGB":
        im = im.convert("RGB")
    if not icc:
        return im, "", 0                                   # no profile embedded
    from PIL import ImageCms
    src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
    name = (ImageCms.getProfileDescription(src) or "").strip()
    dst = ImageCms.createProfile("sRGB")
    im = ImageCms.profileToProfile(im, src, dst, outputMode="RGB")
    return im, name, 3                                     # embedded, converted


# ------------------------------------------------------------- sampling ----

def samp(field, x, y, order=1):
    """Bilinear sample of a 2-D field at float (x, y)."""
    return map_coordinates(field, np.vstack([y, x]), order=order,
                           mode="nearest").astype(np.float32)


def samp3(field, x, y):
    """Nearest-neighbour sample of an [H, W, C] image; C small."""
    xi = np.clip(np.round(x).astype(np.int32), 0, field.shape[1] - 1)
    yi = np.clip(np.round(y).astype(np.int32), 0, field.shape[0] - 1)
    return field[yi, xi]


# ------------------------------------------------------------- the fields --

def channels(rgb8, p):
    """The three fields a ridge can live in, on one comparable scale.

    Luminance is 0..1 and stays exactly as M0a had it, so that tuning survives.
    a* and b* are divided by 100, which puts a full-swing colour opposition --
    his orange against his blue -- at about the same number as a full-swing
    change in light. Both are what a stroke is made of and neither is privileged
    except in the merge, where luminance claims first.
    """
    lin = srgb_to_linear(rgb8)
    lab = linear_to_lab(lin)
    g = float(p["chroma_gain"])
    chans = [lightness(lin), lab[..., 1] * g, lab[..., 2] * g]
    s = float(p["sigma_ridge"])
    return chans, gaussian_filter(lab, (s, s, 0))          # smoothed, for dE


def structure_tensor(chans, p, energy_ref):
    """Di Zenzo: the tensor of a colour image is the sum of its channels'.

    Where chroma is flat this is exactly M0a's luminance tensor. Where luminance
    is flat -- the plateau case, a slab of one loaded colour against another at
    the same value -- the luminance tensor is zero and coherence is meaningless,
    because coherence is a *ratio* and the ratio of two nothings is noise. The
    chroma terms give those passages a direction, and the energy floor below
    stops the ratio being asked at all where there is nothing to divide.
    """
    sg, st = float(p["sigma_grad"]), float(p["sigma_tensor"])
    w = [1.0, float(p["chroma_tensor_w"]), float(p["chroma_tensor_w"])]
    jxx = jxy = jyy = 0.0
    for c, wc in zip(chans, w):
        gx = gaussian_filter(c, sg, order=(0, 1))
        gy = gaussian_filter(c, sg, order=(1, 0))
        jxx = jxx + wc * gx * gx
        jxy = jxy + wc * gx * gy
        jyy = jyy + wc * gy * gy
    jxx = gaussian_filter(jxx, st)
    jxy = gaussian_filter(jxy, st)
    jyy = gaussian_filter(jyy, st)
    d = jxx - jyy
    s = np.hypot(d, 2 * jxy)
    energy = (jxx + jyy).astype(np.float32)
    coh = (s / (energy + EPS)).astype(np.float32)          # 0 isotropic, 1 a line
    coh[energy < energy_ref * float(p["tensor_energy_frac"])] = 0.0
    # major eigenvector = direction of greatest change = ACROSS the stroke.
    a = 0.5 * np.arctan2(2 * jxy, d)
    return (np.cos(a).astype(np.float32), np.sin(a).astype(np.float32), coh, energy)


def ridge_field(F, sigma_ridge, nx, ny):
    """Ridges in one field, read across the orientation field.

    Fnn < 0 is a crest, Fnn > 0 a trough, and on luminance those are a light
    stroke over darker paint and one of his dark contours. On a* and b* they are
    a stroke laid warmer, or cooler, than what it lies against. Strength is the
    scale-normalised curvature across the stroke, which is what makes a 2 mm
    reed-pen contour and a 7 mm loaded sweep comparable numbers.
    """
    Fs = gaussian_filter(F, sigma_ridge)
    lxx = gaussian_filter(F, sigma_ridge, order=(0, 2))
    lxy = gaussian_filter(F, sigma_ridge, order=(1, 1))
    lyy = gaussian_filter(F, sigma_ridge, order=(2, 0))
    lnn = (lxx * nx * nx + 2 * lxy * nx * ny + lyy * ny * ny).astype(np.float32)
    return Fs, lnn * (sigma_ridge ** 2)


# ------------------------------------------------------------------ seeds --

def find_seeds(Fs, lnn, coh, nx, ny, p, thr, core, veto=None):
    """Local extrema of the field across the stroke, spaced and ranked.

    `thr` is calibrated over the whole canvas, not taken as a percentile of this
    tile. A percentile asks each tile what counts as a stroke *here*, so a tile
    of sky and a tile of wheat answer differently and the disagreement lands on
    the boundary between them, which is the one place a seam is visible.

    `veto` is what luminance has already spoken for. DESIGN 4.1 step 3 puts
    chroma ridges in for strokes that are "invisible to a luminance ridge
    filter" -- one loaded colour beside another at the same value -- and taking
    the plain union of the ridge maps instead finds the same stroke two and
    three times over: measured on the gate tile, 99% of chroma traces ran within
    one stroke width of a luminance trace, for 2.3 points of coverage at 2.75x
    the strokes. Seeding chroma only where luminance is blind is what the design
    actually says, and it costs what it contributes.

    `core` is the tile's exclusive claim: seeds outside it belong to a
    neighbour. The cores partition the canvas exactly, and every core is inset
    at least half the hard arc cap from its own tile's edges, so a trace seeded
    anywhere in one can walk its full length without ever meeting a tile edge.
    That is what makes tile truncation structurally impossible rather than
    something the merge has to repair afterwards.
    """
    h, w = Fs.shape
    strength = np.abs(lnn)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    step = max(2.0, p["sigma_ridge"] * 0.5)
    up = map_coordinates(Fs, [(yy + ny * step).ravel(), (xx + nx * step).ravel()],
                         order=1, mode="nearest").reshape(h, w)
    dn = map_coordinates(Fs, [(yy - ny * step).ravel(), (xx - nx * step).ravel()],
                         order=1, mode="nearest").reshape(h, w)
    crest = (Fs > up) & (Fs > dn) & (lnn < 0)
    trough = (Fs < up) & (Fs < dn) & (lnn > 0)
    # Suppression runs over the core *dilated* by the suppression radius, and
    # only then are seeds outside the core dropped. Masking to the core first
    # means a maximum one pixel inside the boundary and one just outside it
    # never suppress each other, so both tiles keep their own -- and the same
    # stroke is traced twice, a pixel apart, in a way the merge only mostly
    # catches. Measured: duplicates ran at 2.2x the canvas rate along the core
    # boundaries. Both tiles see identical data this near a boundary, so both
    # compute the same suppression and exactly one of them owns the survivor.
    sp = int(p["seed_spacing"])
    live = coh > p["coherence_min"]
    grown = (max(0, core[0] - sp), max(0, core[1] - sp),
             min(w, core[2] + sp), min(h, core[3] + sp))
    live[:grown[1], :] = False
    live[grown[3]:, :] = False
    live[:, :grown[0]] = False
    live[:, grown[2]:] = False
    if veto is not None:
        live &= ~veto

    # Crests and troughs are seeded separately. Sharing one suppression window
    # lets a loaded impasto ridge suppress the reed-pen contour lying against
    # it, and on this canvas that is the whole figure: the reaper is drawn in
    # dark blue outline against wheat that shouts.
    ok = np.zeros_like(live)
    for mask in (crest & live, trough & live):
        if not mask.any():
            continue
        m = mask & (strength >= thr)
        masked = np.where(m, strength, -np.inf)
        ok |= m & (masked >= maximum_filter(masked, size=2 * sp + 1))

    ok[:core[1], :] = False                       # the survivors this tile owns
    ok[core[3]:, :] = False
    ok[:, :core[0]] = False
    ok[:, core[2]:] = False
    ys, xs = np.nonzero(ok)
    order = np.argsort(-strength[ys, xs])
    ys, xs = ys[order], xs[order]
    pol = np.where(crest[ys, xs], 1.0, -1.0).astype(np.float32)
    return xs.astype(np.float32), ys.astype(np.float32), pol, strength[ys, xs]


# ------------------------------------------------------------------ trace --

def walk(x0, y0, pol, sign, fields, p):
    """Advance every trace one step at a time, all of them at once.

    Vectorised because the tuning loop is the schedule (BUILD.md, two tracks):
    a per-stroke Python loop over 170 steps costs minutes, this costs seconds.

    Terminates on exactly what DESIGN.md 4.1 step 4 lists -- a coherence drop, a
    colour change past a dE threshold, a curvature limit, a maximum arc -- and
    on nothing else. An earlier draft also stopped when the ridge's sign flipped,
    which quietly killed a third of all traces: a wide loaded stroke is a
    plateau, not a crest, so its centre has no curvature to speak of and the
    sign there is noise.
    """
    Fs, coh, tx, ty, lab = fields
    h, w = Fs.shape
    n = len(x0)
    nsteps = int(p["max_arc"] / 2 / p["step"]) + 2
    step, rec = float(p["step"]), float(p["recentre"])

    px = np.zeros((n, nsteps), np.float32)
    py = np.zeros((n, nsteps), np.float32)
    px[:, 0], py[:, 0] = x0, y0
    live = np.ones(n, bool)
    count = np.ones(n, np.int32)
    spill = np.zeros(n, bool)
    why = np.zeros(n, np.int8)          # which condition ended each half-trace
    total_turn = np.zeros(n, np.float32)
    arc = np.zeros(n, np.float32)
    half_cap = float(p["max_arc"]) * 0.5

    dx = samp(tx, x0, y0) * sign
    dy = samp(ty, x0, y0) * sign
    lab0 = samp3(lab, x0, y0)
    offs = np.linspace(-1.0, 1.0, 13, dtype=np.float32) * rec
    blend = float(p["dir_blend"])

    x, y = x0.copy(), y0.copy()
    for s in range(1, nsteps):
        idx = np.nonzero(live)[0]
        if idx.size == 0:
            break
        cx, cy, cdx, cdy = x[idx], y[idx], dx[idx], dy[idx]

        # RK2 along the orientation field, resolving the director's sign, then
        # blended with the direction we were already going. Without the blend
        # the tensor's own jitter at a 6 px step reads as curvature and trips
        # the turn limit on a straight stroke.
        mx, my = cx + cdx * step * 0.5, cy + cdy * step * 0.5
        ux, uy = samp(tx, mx, my), samp(ty, mx, my)
        flip = np.sign(ux * cdx + uy * cdy)
        flip[flip == 0] = 1.0
        ux, uy = ux * flip, uy * flip
        ux, uy = blend * cdx + (1 - blend) * ux, blend * cdy + (1 - blend) * uy
        m = np.hypot(ux, uy) + EPS
        ux, uy = ux / m, uy / m
        nxs, nys = cx + ux * step, cy + uy * step

        # Re-centre across the stroke: the one thing that stops a trace sliding
        # off a stroke and fitting the gap between two of them. The centroid of
        # everything above half prominence, not the argmax -- on a plateau the
        # argmax is noise and this is the middle of the slab.
        anx, any_ = -uy, ux
        sx = nxs[:, None] + anx[:, None] * offs[None, :]
        sy = nys[:, None] + any_[:, None] * offs[None, :]
        prof = map_coordinates(Fs, [sy.ravel(), sx.ravel()], order=1,
                               mode="nearest").reshape(len(idx), -1)
        prof = prof * pol[idx][:, None]
        pmax = prof.max(1, keepdims=True)
        pmin = prof.min(1, keepdims=True)
        wgt = np.maximum(prof - 0.5 * (pmax + pmin), 0.0)
        wsum = wgt.sum(1) + EPS
        shift = (wgt * offs[None, :]).sum(1) / wsum * 0.6
        shift = np.clip(shift, -rec, rec)
        nxs = nxs + anx * shift
        nys = nys + any_ * shift

        # arc is the path actually walked, not the step count: re-centring
        # moves the trace sideways as well as forward, so a 6 px step can lay
        # down 19 px of polyline. Counting steps let marks reach 1300 px against
        # a 1024 px cap -- and the cap is what has to clear the tile overlap,
        # or long strokes acquire a seam at every tile boundary.
        arc[idx] += np.hypot(nxs - cx, nys - cy)

        turn = np.abs(np.arctan2(ux * cdy - uy * cdx, ux * cdx + uy * cdy))
        total_turn[idx] += turn
        c = samp(coh, nxs, nys)
        dlab = samp3(lab, nxs, nys) - lab0[idx]
        de = np.sqrt((dlab ** 2).sum(-1))
        inside = (nxs > 1) & (nxs < w - 2) & (nys > 1) & (nys < h - 2)

        tests = [inside, turn < p["max_turn"], c > p["coherence_min"],
                 de < p["de_max"], total_turn[idx] < p["max_total_turn"],
                 arc[idx] < half_cap]
        keep = tests[0] & tests[1] & tests[2] & tests[3] & tests[4] & tests[5]
        # first failing condition, for the tuning loop: a tracer that stops for
        # the wrong reason is the difference between a mark and a fragment, and
        # two of M0a's nine bugs were exactly that
        stop = np.nonzero(~keep)[0]
        if stop.size:
            first = np.argmax(~np.stack([t[stop] for t in tests], 1), axis=1)
            why[idx[stop]] = np.where(why[idx[stop]] == 0, first + 1, why[idx[stop]])

        x[idx], y[idx] = nxs, nys
        dx[idx], dy[idx] = ux, uy
        px[idx, s] = nxs
        py[idx, s] = nys
        count[idx] += keep
        spill[idx[~inside]] = True
        live[idx[~keep]] = False

    why[live] = 7                                    # ran out of steps
    return px, py, count, spill, why


WHY = ["", "tile edge", "curvature", "coherence", "colour break",
       "total turn", "arc cap", "step budget"]


def trace_all(xs, ys, pol, fields, p, tally=None):
    fwd = walk(xs, ys, pol, +1.0, fields, p)
    bwd = walk(xs, ys, pol, -1.0, fields, p)
    if tally is not None:
        for w in np.concatenate([fwd[4], bwd[4]]):
            tally[WHY[int(w)]] = tally.get(WHY[int(w)], 0) + 1
    lines, spill = [], []
    for i in range(len(xs)):
        nb, nf = bwd[2][i], fwd[2][i]
        bx, by = bwd[0][i, :nb][::-1], bwd[1][i, :nb][::-1]
        fx, fy = fwd[0][i, 1:nf], fwd[1][i, 1:nf]
        lines.append(np.stack([np.concatenate([bx, fx]),
                               np.concatenate([by, fy])], 1))
        spill.append(bool(bwd[3][i] or fwd[3][i]))
    return lines, np.array(spill, bool)


# ------------------------------------------------------------- dedup/merge --

def arclen(pts):
    return float(np.hypot(*np.diff(pts, axis=0).T).sum()) if len(pts) > 1 else 0.0


def dedup(traces, shape, p, scale=1):
    """One stroke found from two seeds is one stroke. Claim in strength order.

    Run once over the whole canvas rather than once per tile, so a stroke found
    from a seed in one tile's core and again from a seed in its neighbour's is
    the same case as a stroke found twice inside one tile -- and gets the same
    answer. A separate cross-tile merge would be a second code path doing the
    same job, and the second path is the one that would be quietly wrong.

    Angle is stamped as int8 over pi, which is 0.025 rad -- twenty times finer
    than the tolerance that reads it, and four times smaller than a float32
    plane, which at canvas scale is the difference between 100 MB and 400.

    The claim band is sampled at about a pixel. It used to be sampled at nine
    points whatever the stroke's width, which across 100 px of paint leaves
    12 px gaps -- and a near-parallel duplicate lying in a gap registers no hit
    at all, so it is kept. With one ridge field that merely under-merged; with
    three fields finding the same stroke three times it meant the tile came out
    with three of everything.
    """
    h, w = shape
    claimed = np.zeros((h, w), bool)
    angle = np.zeros((h, w), np.int8)
    keep = []
    order = sorted(range(len(traces)), key=lambda i: -traces[i]["strength"])
    for i in order:
        pts = traces[i]["pts"] / scale
        if len(pts) < 3:
            continue
        d = np.gradient(pts, axis=0)
        th = np.arctan2(d[:, 1], d[:, 0])
        xi = np.clip(pts[:, 0].astype(np.int32), 0, w - 1)
        yi = np.clip(pts[:, 1].astype(np.int32), 0, h - 1)
        hit = claimed[yi, xi]
        if hit.any():
            prev = angle[yi, xi].astype(np.float32) * (np.pi / 128.0)
            da = np.abs(np.angle(np.exp(1j * (prev - th))))
            da = np.minimum(da, np.pi - da)
            frac = float((hit & (da < p["dedup_angle"])).mean())
            if frac > p["dedup_frac"]:
                continue
        keep.append(i)
        # stamp a band narrower than the stroke, so crossings stay legal,
        # and sample it at about a pixel so nothing can lie in a gap
        half = p["dedup_band"] * traces[i]["width"] / scale
        band = np.linspace(-1, 1, max(3, 2 * int(half) + 1)) * half
        ax, ay = -np.sin(th), np.cos(th)
        sx = np.clip((pts[:, 0:1] + ax[:, None] * band).astype(np.int32), 0, w - 1)
        sy = np.clip((pts[:, 1:2] + ay[:, None] * band).astype(np.int32), 0, h - 1)
        claimed[sy, sx] = True
        angle[sy, sx] = np.rint(th[:, None] * (128.0 / np.pi)).astype(np.int8)
    return keep


# --------------------------------------------------------------- fit/attrs --

def fit_quadratic(pts):
    """Least-squares P1 with the endpoints pinned. Returns (bezier, max error)."""
    p0, p2 = pts[0], pts[-1]
    d = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
    if d[-1] < EPS:
        return np.stack([p0, p0, p2]), 0.0
    t = (d / d[-1]).astype(np.float32)
    b1 = 2 * t * (1 - t)
    rhs = pts - ((1 - t) ** 2)[:, None] * p0 - (t ** 2)[:, None] * p2
    denom = float((b1 * b1).sum())
    p1 = (b1[:, None] * rhs).sum(0) / denom if denom > EPS else (p0 + p2) * 0.5
    ev = ((1 - t) ** 2)[:, None] * p0 + b1[:, None] * p1 + (t ** 2)[:, None] * p2
    return np.stack([p0, p1, p2]), float(np.hypot(*(ev - pts).T).max())


def fit_chain(pts, tol, depth, min_arc):
    """His marks are one arc. The Saint-Remy curls are a chain of them."""
    bez, err = fit_quadratic(pts)
    if err <= tol or depth <= 0 or len(pts) < 8 or arclen(pts) < 2 * min_arc:
        return [(pts, bez)]
    k = len(pts) // 2
    return (fit_chain(pts[:k + 1], tol, depth - 1, min_arc)
            + fit_chain(pts[k:], tol, depth - 1, min_arc))


def stroke_width(pts, Fs, pol, p):
    """Perpendicular extent of the ridge: out to the gap on either side.

    Half-prominence measured against the nearest local minimum collapses to
    nothing whenever the trace sits on a stroke's shoulder rather than its exact
    crest, which on wide loaded paint is most of the time. So walk out to the
    first minimum that follows a real descent -- the shadowed gap between this
    stroke and the next -- and take the paint as a little inside that.
    """
    m = max(1, len(pts) // 12)
    q = pts[::m]
    if len(q) < 2:
        return float(p["width_min"])
    d = np.gradient(q, axis=0) if len(q) > 2 else np.diff(q, axis=0, prepend=q[:1])
    th = np.arctan2(d[:, 1], d[:, 0])
    ax, ay = -np.sin(th), np.cos(th)
    lim = float(p["width_max"]) * 0.8
    ns = int(lim) + 1
    offs = np.linspace(-lim, lim, 2 * ns + 1, dtype=np.float32)
    sx = q[:, 0:1] + ax[:, None] * offs[None, :]
    sy = q[:, 1:2] + ay[:, None] * offs[None, :]
    prof = map_coordinates(Fs, [sy.ravel(), sx.ravel()], order=1,
                           mode="nearest").reshape(len(q), -1) * pol
    mid = ns
    drop = float(p["width_drop_frac"])
    widths = []
    for row in prof:
        rng = float(np.ptp(row))
        if rng < EPS:
            continue
        need = drop * rng
        edges = []
        for sgn in (-1, 1):
            i, peak, foot = mid, row[mid], None
            while 0 < i + sgn < len(row) - 1:
                i += sgn
                peak = max(peak, row[i])
                if peak - row[i] >= need and row[i + sgn] > row[i]:
                    foot = i
                    break
            edges.append(offs[foot] if foot is not None else sgn * lim)
        widths.append((edges[1] - edges[0]) * float(p["width_gap_frac"]))
    if not widths:
        return float(p["width_min"])
    return float(np.clip(np.median(widths), p["width_min"], p["width_max"]))


def trough_is_paint(pts, lab, width, p):
    """A dark line is a stroke only if it is a different colour, not just darker.

    Between two ridges of impasto there is a shadowed gap, and it reads to a
    luminance ridge filter exactly like one of his dark contours. The difference
    is chroma: the contour on this canvas is blue laid on yellow, the gap is the
    same yellow with less light on it. Without this test the wheat fills with
    dark ribbons lying in its own shadows. Only luminance troughs need it -- a
    chroma trough is a colour difference by construction.
    """
    m = max(1, len(pts) // 12)
    q = pts[::m]
    d = np.gradient(q, axis=0) if len(q) > 2 else np.diff(q, axis=0, prepend=q[:1])
    th = np.arctan2(d[:, 1], d[:, 0])
    ax, ay = -np.sin(th), np.cos(th)
    off = width * 0.9
    c = samp3(lab, q[:, 0], q[:, 1])
    l = samp3(lab, q[:, 0] - ax * off, q[:, 1] - ay * off)
    r = samp3(lab, q[:, 0] + ax * off, q[:, 1] + ay * off)
    dl = np.hypot(c[:, 1] - l[:, 1], c[:, 2] - l[:, 2])
    dr = np.hypot(c[:, 1] - r[:, 1], c[:, 2] - r[:, 2])
    return float(np.median(np.minimum(dl, dr))) >= p["trough_chroma_min"]


def stroke_colour(pts, srgb, hfield, width, p):
    """Median (never mean: the mean eats the neighbour at every crossing).

    `hfield` is DESIGN 4.1 step 6's height estimate and is None unless
    --height 0 asked for it; M1 replaced it and the reason is in relief.py.
    """
    m = max(1, len(pts) // 24)
    q = pts[::m]
    d = np.gradient(q, axis=0) if len(q) > 2 else np.diff(q, axis=0, prepend=q[:1])
    th = np.arctan2(d[:, 1], d[:, 0])
    ax, ay = -np.sin(th), np.cos(th)
    band = np.linspace(-1, 1, 7, dtype=np.float32) * (width * p["colour_band"])
    sx = (q[:, 0:1] + ax[:, None] * band).ravel()
    sy = (q[:, 1:2] + ay[:, None] * band).ravel()
    cols = samp3(srgb, sx, sy)                       # straight off the memmap
    if hfield is None:
        return np.median(cols, axis=0), 0.0
    hs = samp3(hfield[..., None], sx / HDS, sy / HDS)[:, 0].astype(np.float32)
    return np.median(cols, axis=0), float(np.median(hs))


# ------------------------------------------------------------ the working ---

def params_hash(p):
    clean = {k: v for k, v in sorted(p.items()) if not k.startswith("_")}
    return hashlib.sha256(json.dumps(clean, sort_keys=True).encode()).hexdigest()


def file_sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def working_image(p, src, verbose=True):
    """Decode, honour the profile, find the painting, downsample once, cache it.

    Everything downstream reads this memory-mapped, so a 98 MP canvas costs the
    pipeline a file handle rather than 1.2 GB.
    """
    from PIL import Image
    import canvas_edge
    cache = os.path.join(ROOT, "ref", "work", p["slug"] + ".npy")
    meta_path = os.path.splitext(cache)[0] + ".json"
    want = dict(px_per_cm=p["px_per_cm"], canvas_cm=p["canvas_cm"], src=p["source"])
    if os.path.exists(cache) and os.path.exists(meta_path):
        meta = json.load(open(meta_path))
        if all(meta.get(k) == v for k, v in want.items()):
            return np.load(cache, mmap_mode="r"), meta

    w = int(round(p["canvas_cm"][0] * p["px_per_cm"]))
    im, profile, cflags = decode(src, min_width=w)
    (cx, cy, cw_s, ch_s), (W, H) = canvas_edge.rect(src)
    if (cx, cy, cw_s, ch_s) != (0, 0, W, H):
        if verbose:
            print(f"  canvas edge: cropping {W}x{H} to {cw_s}x{ch_s} at ({cx},{cy})")
        # the edge detector reads the scan; the decoder may already have halved
        # it under us, so the box comes back in scan pixels and is scaled here.
        k = im.size[0] / W
        im = im.crop(tuple(int(round(t * k))
                           for t in (cx, cy, cx + cw_s, cy + ch_s)))
    h = int(round(im.size[1] * w / im.size[0]))
    if verbose:
        print(f"  working image {w}x{h} at {p['px_per_cm']:.0f} px/cm"
              f"   profile: {profile or 'NONE EMBEDDED, assuming sRGB'}")
    a = np.asarray(im.resize((w, h), Image.LANCZOS))
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    np.save(cache, a)
    meta = dict(want, profile=profile, colour_flags=cflags,
                crop_rect=[cx, cy, cw_s, ch_s], scan_px=[W, H])
    json.dump(meta, open(meta_path, "w"))
    return np.load(cache, mmap_mode="r"), meta


def low_frequency(work, p):
    """The canvas-wide wide blur under the height estimate, computed once.

    sigma_height is 140 px. A tile computing that for itself invents the outer
    420 px of its own answer from whatever the filter's boundary mode fabricates,
    and two tiles fabricate differently -- which puts a step in the height field
    along every tile edge. So it is computed here, on the whole canvas at 1/8,
    where 140 px is 17 px and the whole thing costs a second.
    """
    small = np.asarray(work[::DS, ::DS])
    L = lightness(srgb_to_linear(small))
    return gaussian_filter(L, float(p["sigma_height"]) / DS).astype(np.float32)


HDS = 2                     # the height field is kept at half the working scale


def height_field(work, hbase, p, band=2048):
    """The impasto estimate for the whole canvas, computed once, in bands.

    Two reasons it is not per tile. Holding twenty tiles' images so that colour
    and height can be sampled after the merge is 3.6 GB against a 6 GB ceiling.
    And a field assembled from tiles is a field with tile edges in it: this one
    is banded with a 3-sigma overlap and written only in each band's interior,
    so the result is identical to computing it in one piece.

    Half scale and float16, because this is DESIGN 4.1 step 6's
    luminance-above-a-neighbourhood estimate, which BUILD.md M1 says is
    measuring colour rather than relief. Storing an estimate that is known to be
    wrong at full precision would be a strange thing to spend 400 MB on.
    """
    H, W = work.shape[:2]
    sr = float(p["sigma_ridge"])
    pad = int(3 * sr) + 2
    oh, ow = (H + HDS - 1) // HDS, (W + HDS - 1) // HDS
    out = np.zeros((oh, ow), np.float16)
    for oy in range(0, oh, band):
        oy1 = min(oh, oy + band)
        y0, y1 = max(0, oy * HDS - pad), min(H, oy1 * HDS + pad)
        L = lightness(srgb_to_linear(np.asarray(work[y0:y1])))
        Fs = gaussian_filter(L, sr)
        rows = np.arange(oy, oy1) * HDS - y0
        yy, xx = np.meshgrid(rows.astype(np.float32) + y0,
                             np.arange(0, ow, dtype=np.float32) * HDS, indexing="ij")
        wide = map_coordinates(hbase, [(yy / DS).ravel(), (xx / DS).ravel()],
                               order=1, mode="nearest").reshape(len(rows), ow)
        out[oy:oy1] = (Fs[rows][:, ::HDS][:, :ow] - wide).astype(np.float16)
        del L, Fs, wide
    return out


def calibrate(work, p, seed=18531890, n=14, crop=768, pad=96):
    """One threshold per channel for the whole canvas, from sampled crops.

    The alternative is a percentile per tile, and a percentile per tile is a
    seam: it asks each tile what counts as a stroke *here*, so the sky's answer
    and the wheat's answer differ and they differ exactly along the line where
    the two tiles meet. Sampling instead means every tile is measured against
    the same canvas.
    """
    rng = np.random.default_rng(seed)
    H, W = work.shape[:2]
    xs = rng.integers(0, max(1, W - crop), n)
    ys = rng.integers(0, max(1, H - crop), n)
    pooled = [[] for _ in range(3)]
    energies = []
    for x, y in zip(xs, ys):
        rgb = np.ascontiguousarray(work[y:y + crop, x:x + crop])
        chans, _ = channels(rgb, p)
        # no floor here: this pass is what decides where the floor goes
        nx, ny, _, energy = structure_tensor(chans, dict(p, tensor_energy_frac=0.0), 1.0)
        energies.append(energy[pad:-pad, pad:-pad].ravel())
        for c in range(3):
            _, lnn = ridge_field(chans[c], p["sigma_ridge"], nx, ny)
            pooled[c].append(np.abs(lnn[pad:-pad, pad:-pad]).ravel())
    energy_ref = float(np.median(np.concatenate(energies)))
    thr = [float(np.percentile(np.concatenate(v), p["seed_strength_pct"]))
           for v in pooled]
    return dict(energy_ref=energy_ref, seed_thr=thr)


def tile_grid(W, H, size, step):
    """Tile origins, and the cores that partition the canvas between them.

    A core is a tile's exclusive right to seed. The boundary between two cores
    is the midpoint of the overlap they share, which puts every core at least
    half the overlap in from its own tile's edges -- and the overlap is the hard
    arc cap, so a trace seeded anywhere in a core can walk its full length in
    both directions without ever reaching the edge of the tile that owns it.
    Tile truncation is then not something the merge repairs; it cannot happen.
    """
    def axis(n):
        if n <= size:
            return [0], [0, n]
        o = list(range(0, n - size, step)) + [n - size]
        b = [0] + [(o[i - 1] + size + o[i]) // 2 for i in range(1, len(o))] + [n]
        return o, b
    ox, bx = axis(W)
    oy, by = axis(H)
    out = []
    for j, y in enumerate(oy):
        for i, x in enumerate(ox):
            out.append(dict(origin=(x, y), size=(min(size, W - x), min(size, H - y)),
                            core=(bx[i], by[j], bx[i + 1], by[j + 1])))
    return out


# ------------------------------------------------------------- one tile ----

def extract_tile(work, cal, p, tile, tally=None):
    """Every trace whose seed belongs to this tile, in canvas coordinates.

    Nothing about the tile is kept. Colour is read from the memory-mapped canvas
    at fitting time and height from the canvas-wide field, so the tile's own
    planes -- 178 MB of them -- go out of scope the moment this returns.
    """
    x0, y0 = tile["origin"]
    tw, th = tile["size"]
    rgb8 = np.ascontiguousarray(work[y0:y0 + th, x0:x0 + tw])
    chans, labs = channels(rgb8, p)
    nx, ny, coh, _ = structure_tensor(chans, p, cal["energy_ref"])
    tx, ty = -ny, nx                                   # along the stroke
    core = (max(0, tile["core"][0] - x0), max(0, tile["core"][1] - y0),
            min(tw, tile["core"][2] - x0), min(th, tile["core"][3] - y0))
    out, veto = [], None
    prio = [1.0, float(p["chroma_priority"]), float(p["chroma_priority"])]
    for c in range(3):
        Fs, lnn = ridge_field(chans[c], p["sigma_ridge"], nx, ny)
        if c == 0:
            r = int(p["chroma_veto_px"])
            veto = maximum_filter(np.abs(lnn) >= cal["seed_thr"][0],
                                  size=2 * r + 1) if r > 0 else None
        sx, sy, pol, strength = find_seeds(Fs, lnn, coh, nx, ny, p,
                                           cal["seed_thr"][c], core,
                                           None if c == 0 else veto)
        if not len(sx):
            continue
        lines, spill = trace_all(sx, sy, pol, (Fs, coh, tx, ty, labs), p, tally)
        for i, pts in enumerate(lines):
            if arclen(pts) < p["min_arc"]:
                continue
            wid = stroke_width(pts, Fs, pol[i], p)
            if c == 0 and pol[i] < 0 and not trough_is_paint(pts, labs, wid, p):
                continue                      # a shadow between strokes, not paint
            # strength in units of this channel's own bar, so the three are
            # comparable and the priority below actually decides the order
            out.append(dict(pts=pts + np.array([x0, y0], np.float32),
                            strength=float(strength[i]) / max(cal["seed_thr"][c], EPS)
                            * prio[c],
                            width=wid, pol=float(pol[i]), chan=c,
                            spill=bool(spill[i])))
    return out


# ------------------------------------------------------------- underlayer --

def raster(recs, cw, ch, scale, colour=True, base=None):
    """Flat orthographic rasterisation of the fitted strokes, at 1/scale."""
    W, H = int(np.ceil(cw / scale)), int(np.ceil(ch / scale))
    img = np.zeros((H, W, 3), np.float32) if colour else None
    if colour and base is not None:
        yy0, xx0 = np.mgrid[0:H, 0:W]
        img[:] = base[np.clip(yy0 * base.shape[0] // H, 0, base.shape[0] - 1),
                      np.clip(xx0 * base.shape[1] // W, 0, base.shape[1] - 1)]
    cov = np.zeros((H, W), np.float32)
    lay = np.zeros((H, W), np.float32)
    short = min(cw, ch)
    seq = np.argsort([r["o"] for r in recs])           # painter's algorithm
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for i in seq:
        r = recs[i]
        p0, p1, p2 = (np.array(q, np.float32) * [cw, ch] / scale for q in r["p"])
        wpx = max(0.8, r["w"] * short / scale * 0.5)
        t = np.linspace(0, 1, 40, dtype=np.float32)[:, None]
        c = (1 - t) ** 2 * p0 + 2 * t * (1 - t) * p1 + t ** 2 * p2
        xa = max(0, int(c[:, 0].min() - wpx) - 1)
        xb = min(W, int(c[:, 0].max() + wpx) + 2)
        ya = max(0, int(c[:, 1].min() - wpx) - 1)
        yb = min(H, int(c[:, 1].max() + wpx) + 2)
        if xb <= xa or yb <= ya:
            continue
        d = np.sqrt((xx[ya:yb, xa:xb, None] - c[None, None, :, 0]) ** 2 +
                    (yy[ya:yb, xa:xb, None] - c[None, None, :, 1]) ** 2).min(-1)
        a = np.clip((wpx - d) / 1.2, 0, 1)          # antialias, not feather
        cov[ya:yb, xa:xb] = np.maximum(cov[ya:yb, xa:xb], a)
        lay[ya:yb, xa:xb] += a * wpx
        if colour:
            col = np.array(r["rgb"], np.float32) / 255.0
            sub = img[ya:yb, xa:xb]
            img[ya:yb, xa:xb] = sub * (1 - a[..., None]) + col * a[..., None]
    return img, cov, lay


def underlayer(work, cov, p):
    """What is visible of the ground between the strokes, extended beneath them.

    DESIGN 4.1 step 7 asks for the residual after the strokes are subtracted,
    blurred. But the residual in a *covered* passage is the fitting error, and
    blurring that back in reintroduces exactly the stroke-scale structure the
    strokes are supposed to be carrying -- which is the failure the band-pass
    criterion exists to catch, arriving through the back door. So the evidence
    here is only the pixels no stroke covers: a normalised convolution weighted
    by (1 - coverage), which is literally the ground as seen between the marks,
    smoothly continued underneath them. Where the tracer found nothing at all --
    a scumbled passage, a thin wash -- there is no coverage, so those places
    speak for themselves and are reproduced.
    """
    ds = int(p["under_ds"])
    small = np.asarray(work[::ds, ::ds]).astype(np.float32) / 255.0
    h, w = small.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sy = yy * (cov.shape[0] - 1) / max(1, h - 1)
    sx = xx * (cov.shape[1] - 1) / max(1, w - 1)
    a = map_coordinates(cov, [sy.ravel(), sx.ravel()], order=1,
                        mode="nearest").reshape(h, w)
    wgt = np.clip(1.0 - a, 0.0, 1.0).astype(np.float32)
    s = float(p["sigma_under"]) / ds
    num = np.stack([gaussian_filter(small[..., c] * wgt, s) for c in range(3)], -1)
    den = gaussian_filter(wgt, s)[..., None]
    # a passage with no bare pixel anywhere near it has no local evidence at
    # all; widen until it does rather than leaving a hole
    for extra in (2.0, 6.0, 20.0):
        thin = den < 1e-3
        if not thin.any():
            break
        n2 = np.stack([gaussian_filter(small[..., c] * wgt, s * extra)
                       for c in range(3)], -1)
        d2 = gaussian_filter(wgt, s * extra)[..., None]
        num = np.where(thin, n2, num)
        den = np.where(thin, d2, den)
    return np.clip(num / np.maximum(den, 1e-6), 0, 1)


def bandpass_ratio(work, recs, cw, ch, med_w, region=None, under=None, scale=4):
    """Do the strokes carry the picture, or does the underlayer?

    BUILD.md's risk table: if the residual carries it, we have built a
    projection show with sprinkles. The number is the energy at stroke scale in
    the reconstruction over the energy at stroke scale in the scan -- a
    difference of Gaussians either side of the median stroke width, so it is
    blind to the broad tone the underlayer is allowed to have and to the weave
    and grain below the paint.

    The reconstruction is composited over the underlayer, not over black. A
    black ground turns every uncovered pixel into the highest-contrast edge on
    the canvas and the ratio came out at 4.07 -- measuring the holes, not the
    paint.
    """
    img = raster(recs, cw, ch, scale, base=under)[0]
    src = np.asarray(work[::scale, ::scale]).astype(np.float32) / 255.0
    h = min(img.shape[0], src.shape[0])
    w = min(img.shape[1], src.shape[1])
    img, src = img[:h, :w], src[:h, :w]
    if region is not None:                 # tuning one tile: judge that tile
        x, y, tw, th = (v // scale for v in region)
        img = img[y:y + th, x:x + tw]
        src = src[y:y + th, x:x + tw]
    s1, s2 = med_w / scale * 0.25, med_w / scale * 1.5

    def energy(a):
        g = a.mean(-1)
        bp = gaussian_filter(g, s1) - gaussian_filter(g, s2)
        return float((bp ** 2).mean())
    return energy(img) / max(energy(src), EPS)


# -------------------------------------------------------------- the seams --

def seam_report(recs, cw, ch, bounds, med_w, trials=200, seed=18531890):
    """Two direct tests for the part of the pipeline most likely to be wrong.

    Broken chains: a trace cut by a boundary ends *at* it. So count the stroke
    ends that fall near a core boundary -- and compare against the same count
    for many sets of arbitrary interior lines, because strokes end everywhere
    and a single number has no meaning without knowing what a number looks like
    when nothing is wrong. The control is a distribution, not one draw: with one
    draw a 12% excess is unreadable, and against 200 draws it is either inside
    the spread or it is not.

    Duplicates: a stroke found in two tiles and kept twice lies *on* another,
    following it for its whole length. The first version of this test binned
    midpoints and asked for near-parallel neighbours, which in a wheatfield is a
    description of wheat -- it called a third of the tile duplicated and was
    measuring stroke density. A duplicate has to be a curve that goes where
    another curve goes: every sample of each within a fraction of a width of the
    other. They are counted twice, once anywhere and once only near a boundary,
    since a cross-tile duplicate has to be there.
    """
    ends = np.array([[r["p"][0][0] * cw, r["p"][0][1] * ch] for r in recs] +
                    [[r["p"][2][0] * cw, r["p"][2][1] * ch] for r in recs])
    near = med_w * 0.5
    bx, by = bounds
    inner_x = np.array([v for v in bx if 0 < v < cw], float)
    inner_y = np.array([v for v in by if 0 < v < ch], float)

    def count(xs, ys):
        d = np.full(len(ends), np.inf)
        for v in xs:
            d = np.minimum(d, np.abs(ends[:, 0] - v))
        for v in ys:
            d = np.minimum(d, np.abs(ends[:, 1] - v))
        return int((d < near).sum()), d < near

    n_seam, seam_mask = count(inner_x, inner_y)
    rng = np.random.default_rng(seed)
    ctrl = np.array([count(rng.integers(int(0.06 * cw), int(0.94 * cw), len(inner_x)),
                           rng.integers(int(0.06 * ch), int(0.94 * ch), len(inner_y)))[0]
                     for _ in range(trials)], float)
    mu, sd = float(ctrl.mean()), float(ctrl.std())
    z = (n_seam - mu) / sd if sd > 1e-9 else 0.0

    t = np.linspace(0, 1, 9, dtype=np.float32)[:, None]
    curves = np.array([((1 - t) ** 2 * np.array(r["p"][0], np.float32) * [cw, ch]
                        + 2 * t * (1 - t) * np.array(r["p"][1], np.float32) * [cw, ch]
                        + t ** 2 * np.array(r["p"][2], np.float32) * [cw, ch])
                       for r in recs], np.float32)
    cell = max(1.0, med_w)
    grid = {}
    for i, c in enumerate(curves):
        for k in set(map(tuple, np.rint(c / cell).astype(np.int64))):
            grid.setdefault(k, []).append(i)
    tol = 0.3 * med_w
    dup = set()
    for cells in grid.values():
        for ai in range(len(cells)):
            for bi in range(ai + 1, len(cells)):
                i, j = cells[ai], cells[bi]
                if i in dup or j in dup:
                    continue
                d = np.hypot(curves[i][:, None, 0] - curves[j][None, :, 0],
                             curves[i][:, None, 1] - curves[j][None, :, 1])
                if max(d.min(1).max(), d.min(0).max()) < tol:
                    dup.add(j)
    # both numbers must ask the same question. An earlier version counted a
    # duplicate as "near a boundary" if either of its ends was, and took the
    # expectation from start points alone -- which doubles the expectation's
    # denominator and manufactures a 1.7x excess out of arithmetic.
    n = len(recs)
    either = seam_mask[:n] | seam_mask[n:]
    at_seam = sum(1 for j in dup if either[j])
    frac_seam = float(either.mean())
    return dict(ends_near_boundary=n_seam, control_mean=mu, control_sd=sd, z=z,
                boundaries=len(inner_x) + len(inner_y), duplicates=len(dup),
                dup_at_seam=at_seam, dup_expected_at_seam=len(dup) * frac_seam)


# ------------------------------------------------------------------- main --

def check_params(p):
    """A number that tunes nothing looks exactly like a number that tunes."""
    known, have = set(PARAMS), {k for k in p if not k.startswith("_")}
    extra, missing = have - known, known - have
    if extra or missing:
        msg = []
        if missing:
            msg.append("missing: " + ", ".join(sorted(missing)))
        if extra:
            msg.append("unknown (tuning nothing): " + ", ".join(sorted(extra)))
        raise SystemExit("params: " + "; ".join(msg))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--tile", default=None, help="one named region, for tuning")
    ap.add_argument("--out", default="strokes/m1")
    ap.add_argument("--height", type=int, default=2, choices=(0, 1, 2),
                    help="0 the design's luminance estimate, 1 the cross-profile "
                         "measurement, 2 the geometric model (default)")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    t_start = time.time()
    p = json.load(open(os.path.join(ROOT, "params", args.slug + ".json")))
    check_params(p)
    src = os.path.join(ROOT, p["source"])
    work, meta = working_image(p, src)
    ch, cw = work.shape[:2]

    if args.tile:
        x, y, tw, th = p["tiles"][args.tile]
        tiles = [dict(origin=(x, y), size=(tw, th), core=(x, y, x + tw, y + th))]
        name, bounds = args.tile, ([x, x + tw], [y, y + th])
    else:
        tiles = tile_grid(cw, ch, int(p["tile_px"]), int(p["tile_step"]))
        name = "canvas"
        bounds = (sorted({t["core"][0] for t in tiles} | {cw}),
                  sorted({t["core"][1] for t in tiles} | {ch}))
    print(f"{args.slug}: {cw}x{ch} at {p['px_per_cm']:.0f} px/cm, "
          f"{len(tiles)} tile(s)", flush=True)

    t = time.time()
    cal = calibrate(work, p)
    hfield = height_field(work, low_frequency(work, p), p) if args.height == 0 else None
    print(f"  calibrated {time.time()-t:.0f}s   energy ref {cal['energy_ref']:.4g}"
          f"   seed thresholds {['%.3g' % v for v in cal['seed_thr']]}", flush=True)

    traces, tally = [], {}
    t = time.time()
    for k, tile in enumerate(tiles):
        got = extract_tile(work, cal, p, tile, tally)
        traces += got
        if not args.quiet:
            print(f"  [{k+1}/{len(tiles)}] {tile['origin']} -> {len(got)} traces"
                  f"   ({time.time()-t:.0f}s)", flush=True)
    tot = max(1, sum(tally.values()))
    print(f"  {len(traces)} traces from {len(tiles)} tile(s) in "
          f"{time.time()-t:.0f}s", flush=True)
    print("  half-traces ended on: " + "  ".join(
        f"{k} {v*100/tot:.0f}%" for k, v in
        sorted(tally.items(), key=lambda kv: -kv[1])), flush=True)

    t = time.time()
    ds = 2 if cw > 6000 else 1                # the merge raster, at half scale
    kept = dedup(traces, (ch // ds + 2, cw // ds + 2), p, scale=ds)
    print(f"  {len(kept)} traces after merge {time.time()-t:.0f}s", flush=True)

    t = time.time()
    out, P, NRM = [], [], []
    for i in kept:
        tr = traces[i]
        pts, wid = tr["pts"], tr["width"]
        arcs = fit_chain(pts, p["fit_tol_frac"] * wid, int(p["fit_max_split"]),
                         p["min_arc"])
        for j, (seg, bez) in enumerate(arcs):
            if arclen(seg) < p["min_arc"] * 0.5:
                continue
            st = relief.stations(seg)
            if st is None:
                continue
            col, hgt = stroke_colour(seg, work, hfield, wid, p)
            P.append(st[0])
            NRM.append(st[1])
            out.append(dict(bez=bez, colour=col, width=wid, height=hgt,
                            arc=arclen(seg), pol=tr["pol"], chan=tr["chan"],
                            mark=i, chain=1 if j < len(arcs) - 1 else 0,
                            spill=1 if tr["spill"] else 0))
    print(f"  {len(out)} strokes after fit {time.time()-t:.0f}s", flush=True)

    # heuristic order (M2 owns the solver): thin and dark before thick and light
    wv = np.array([s["width"] for s in out], np.float32)
    lv = np.array([lightness(srgb_to_linear(s["colour"][None, :]))[0] for s in out],
                  np.float32)
    rank = lambda a: np.argsort(np.argsort(a)) / max(1, len(a) - 1)
    seq = np.argsort(0.5 * rank(wv) + 0.5 * rank(lv))
    ordv = np.zeros(len(out), np.float32)
    ordv[seq] = np.arange(len(out)) / max(1, len(out) - 1)

    # ---- the cross-profile, measured on every canvas whether or not it is what
    # ships. It is the evidence for the choice of height method, and it is per
    # canvas because the next canvas may be off a rig that did not cancel it.
    t = time.time()
    P = np.concatenate(P).astype(np.float32)
    NRM = np.concatenate(NRM).astype(np.float32)
    hw = np.repeat(wv * 0.5, relief.STATIONS).astype(np.float32)
    pol = np.repeat(np.array([s["pol"] for s in out], np.float32), relief.STATIONS)
    surf = relief.surface(work, float(p["sigma_relief"]))
    anti, sym, hvv, live = relief.cues(surf, P, NRM, hw, pol,
                                       float(p["width_drop_frac"]))
    del surf
    light, Rres, _ = relief.solve_light(anti, NRM, live)
    kk, syy, den = relief.per_stroke(anti, sym, NRM, live, relief.STATIONS, light)
    # what the antisymmetric cue implies for the tallest strokes, at the most
    # generous rig the physics allows -- a single lamp at 45 degrees, Lambertian,
    # no cancellation. Any real rig gives less, so this is a lower bound, and if
    # it comes out far under a millimetre the cue is not carrying relief.
    mm = float(np.percentile(np.abs(kk) * wv * 0.5, 99.5)) / p["px_per_cm"] * 10
    print(f"  cross-profile {time.time()-t:.0f}s   light "
          f"{np.degrees(np.arctan2(-light[1], light[0])):+.1f} deg   R {Rres:.4f}"
          f" vs {relief.chance_R(len(out)):.4f} chance"
          f"   implies <= {mm:.2f} mm", flush=True)

    med_w = float(np.median(wv)) if len(wv) else 1.0
    lv85 = float(np.percentile(lv, 85)) if len(lv) else 1.0
    recs = []
    for k, s in enumerate(out):
        dark = s["pol"] < 0
        flags = 1 if (s["chan"] == 0 and dark and s["width"] < 0.7 * med_w) else 0
        flags |= 4 if s["chain"] else 0
        flags |= 8 if s["spill"] else 0
        b = s["bez"]
        recs.append(dict(
            p=[[float(b[i, 0] / cw), float(b[i, 1] / ch)] for i in range(3)],
            rgb=[int(v) for v in s["colour"]],
            w=float(s["width"] / min(cw, ch)), h=0.0, o=float(ordv[k]),
            act=0, flags=int(flags), depth=0.0, arc=float(s["arc"]),
            chan=int(s["chan"]), pol=int(s["pol"]), mark=int(s["mark"])))

    t = time.time()
    _, cov, lay = raster(recs, cw, ch, DS, colour=False)
    if args.height == 2:
        cp = np.array([r["p"] for r in recs], np.float32)
        layers = np.zeros(len(recs), np.float32)
        for tt in (0.25, 0.5, 0.75):
            b = ((1 - tt) ** 2 * cp[:, 0] + 2 * tt * (1 - tt) * cp[:, 1]
                 + tt ** 2 * cp[:, 2]) * [cw, ch] / DS
            layers += lay[np.clip(b[:, 1], 0, lay.shape[0] - 1).astype(np.int32),
                          np.clip(b[:, 0], 0, lay.shape[1] - 1).astype(np.int32)] / 3
        layers /= max(float(np.percentile(layers, 99.5)), EPS)
        hn = relief.model(wv, layers, p)
    elif args.height == 1:
        h1 = relief.measured(kk, syy, den, float(p["relief_sym_w"]))
        lo, hi = np.percentile(h1, 5), np.percentile(h1, 99.5)
        hn = np.clip((h1 - lo) / max(hi - lo, EPS), 0, 1)
        layers = np.zeros(len(recs), np.float32)
    else:
        hv = np.array([s["height"] for s in out], np.float32)
        lo, hi = (np.percentile(hv, 5), np.percentile(hv, 98)) if len(hv) else (0, 1)
        hn = np.clip((hv - lo) / max(hi - lo, EPS), 0, 1)
        layers = np.zeros(len(recs), np.float32)
    for k, r in enumerate(recs):
        r["h"] = float(hn[k])
        r["flags"] |= 2 if (out[k]["chan"] == 0 and out[k]["pol"] > 0
                            and lv[k] > lv85 and hn[k] > 0.6) else 0
    under = underlayer(work, cov, p)
    region = list(p["tiles"][args.tile]) if args.tile else None
    ratio = bandpass_ratio(work, recs, cw, ch, med_w, region, under)
    seams = seam_report(recs, cw, ch, bounds, med_w)
    if region:
        x, y, tw, th = (v // DS for v in region)
        cov_frac = float((cov[y:y + th, x:x + tw] > 0.5).mean())
    else:
        cov_frac = float((cov > 0.5).mean())
    print(f"  underlayer + metrics {time.time()-t:.0f}s", flush=True)

    outdir = os.path.join(ROOT, args.out)
    os.makedirs(outdir, exist_ok=True)
    stem = f"{args.slug}-{name}"
    from PIL import Image
    Image.fromarray((under * 255).astype(np.uint8)).save(
        os.path.join(outdir, stem + "-under.png"))

    doc = dict(
        slug=args.slug, tile=name,
        tile_rect=list(p["tiles"][args.tile]) if args.tile else [0, 0, 0, 0],
        canvas_px=[cw, ch], canvas_cm=p["canvas_cm"], px_per_cm=p["px_per_cm"],
        source=p["source"], source_sha256=file_sha256(src),
        params_sha256=params_hash(p), height_method=int(args.height),
        height_mm=p.get("height_mm", 2.4),
        light=[float(light[0]), float(light[1])], light_R=float(Rres),
        light_mm=float(mm), order_lift_mm=float(p["order_lift_mm"]),
        profile=meta.get("profile", ""), colour_flags=meta.get("colour_flags", 0),
        crop_rect=meta.get("crop_rect", [0, 0, 0, 0]),
        under_ds=int(p["under_ds"]), bandpass=float(ratio), strokes=recs)
    dest = os.path.join(outdir, stem + ".json")
    json.dump(doc, open(dest, "w"))

    arcs = np.array([r["arc"] for r in recs])
    marks = {}
    for s_ in out:
        marks[s_["mark"]] = marks.get(s_["mark"], 0.0) + s_["arc"]
    mk = np.array(list(marks.values())) if marks else np.array([0.0])
    per_chan = [int(sum(1 for r in recs if r["chan"] == c)) for c in range(3)]
    print(f"\n  strokes            {len(recs)}"
          f"   (L {per_chan[0]}  a* {per_chan[1]}  b* {per_chan[2]})")
    print(f"  mean mark          {mk.mean():.0f} px   "
          f"= {mk.mean()/p['px_per_cm']*10:.1f} mm   ({len(mk)} marks)")
    print(f"  mean fitted arc    {arcs.mean():.0f} px   "
          f"= {arcs.mean()/p['px_per_cm']*10:.1f} mm   "
          f"({len(recs)/max(1,len(mk)):.2f} arcs a mark)")
    print(f"  longest mark       {mk.max():.0f} px   (hard cap {p['max_arc']:.0f})")
    print(f"  median width       {med_w:.0f} px   = {med_w/p['px_per_cm']*10:.1f} mm")
    print(f"  coverage           {cov_frac*100:.1f}%")
    hh = np.array([r["h"] for r in recs], np.float32)
    print(f"  relief             method {args.height}"
          f"   {hh.mean()*p['height_mm']:.2f} mm mean, "
          f"{hh.max()*p['height_mm']:.2f} mm peak"
          f"   (cap {p['height_mm']:.2f})")
    if args.height == 2:
        print(f"  paint under a mark {layers.mean():.2f} mean, "
              f"{np.percentile(layers, 99):.2f} at the 99th"
              f"   (1.00 = the 99.5th percentile of the canvas)")
    print(f"  band-pass ratio    {ratio:.2f}          (target >= 0.60)")
    if not args.tile:
        print(f"  ends near boundary {seams['ends_near_boundary']} against "
              f"{seams['control_mean']:.0f} +/- {seams['control_sd']:.0f} at "
              f"{seams['boundaries']} arbitrary lines  (z {seams['z']:+.1f})")
        print(f"  duplicates         {seams['duplicates']}"
              f"   {seams['dup_at_seam']} of them near a boundary, "
              f"{seams['dup_expected_at_seam']:.0f} expected if boundaries "
              f"were not special")
    else:
        print(f"  duplicates         {seams['duplicates']}")
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    rss = rss / (1 << 30) if sys.platform == "darwin" else rss / (1 << 20)
    print(f"  peak RSS           {rss:.1f} GB       (ceiling 6)")
    print(f"  wall time          {time.time()-t_start:.0f} s")
    print(f"  -> {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    main()
