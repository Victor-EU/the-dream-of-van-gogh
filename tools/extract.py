#!/usr/bin/env python3
"""Fit brush strokes to one region of a Van Gogh scan.

M0a is the simplest extractor that could possibly work, per BUILD.md: structure
tensor at ONE scale, luminance ridges only, streamline trace, quadratic Bezier
fit, median colour, width from the ridge's own flanks. No chroma ridges, no
residual underlayer, no tiling, no order solver. The height field here is the
design's luminance-above-a-wide-neighbourhood estimate, which BUILD.md M1 says
is measuring colour rather than relief -- it is in only so the ribbons are not
flat, it is flagged as estimate method 0 in the blob, and M1 replaces it.

Every number lives in params/<slug>.json. Nothing is tuned by editing this file.

    tools/extract.py reaper                  # the tile named by params["tile"]
    tools/extract.py reaper --tile impasto
"""
import argparse, hashlib, json, os, sys, time
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates, maximum_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPS = 1e-12


# ---------------------------------------------------------------- colour ----

def srgb_to_linear(a):
    a = a.astype(np.float32) / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def linear_to_lab(rgb):
    """Linear sRGB -> CIE Lab (D65). Only used for the trace's colour break."""
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


# ------------------------------------------------------- orientation field --

def structure_tensor(L, sigma_grad, sigma_tensor):
    """One scale, per M0a. Returns along-stroke unit vectors and coherence."""
    gx = gaussian_filter(L, sigma_grad, order=(0, 1))
    gy = gaussian_filter(L, sigma_grad, order=(1, 0))
    jxx = gaussian_filter(gx * gx, sigma_tensor)
    jxy = gaussian_filter(gx * gy, sigma_tensor)
    jyy = gaussian_filter(gy * gy, sigma_tensor)
    d = jxx - jyy
    s = np.hypot(d, 2 * jxy)
    coh = (s / (jxx + jyy + EPS)).astype(np.float32)      # 0 isotropic, 1 a line
    # major eigenvector = direction of greatest change = ACROSS the stroke.
    a = 0.5 * np.arctan2(2 * jxy, d)
    return (np.cos(a).astype(np.float32), np.sin(a).astype(np.float32), coh)


def ridge_field(L, sigma_ridge, nx, ny):
    """Luminance ridges read across the orientation field.

    Lnn < 0 is a crest (a light stroke over darker paint), Lnn > 0 a trough
    (his dark contours). Both are strokes. Strength is the scale-normalised
    curvature across the stroke, which is what makes a 2 mm reed-pen contour
    and a 7 mm loaded sweep comparable numbers.
    """
    Ls = gaussian_filter(L, sigma_ridge)
    lxx = gaussian_filter(L, sigma_ridge, order=(0, 2))
    lxy = gaussian_filter(L, sigma_ridge, order=(1, 1))
    lyy = gaussian_filter(L, sigma_ridge, order=(2, 0))
    lnn = (lxx * nx * nx + 2 * lxy * nx * ny + lyy * ny * ny).astype(np.float32)
    return Ls, lnn * (sigma_ridge ** 2)


# ------------------------------------------------------------------ seeds --

def find_seeds(Ls, lnn, coh, nx, ny, p):
    """Local extrema of lightness across the stroke, spaced and ranked."""
    h, w = Ls.shape
    strength = np.abs(lnn)
    # a ridge point is an extremum of Ls along the across-direction n
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    step = max(2.0, p["sigma_ridge"] * 0.5)
    up = map_coordinates(Ls, [(yy + ny * step).ravel(), (xx + nx * step).ravel()],
                         order=1, mode="nearest").reshape(h, w)
    dn = map_coordinates(Ls, [(yy - ny * step).ravel(), (xx - nx * step).ravel()],
                         order=1, mode="nearest").reshape(h, w)
    crest = (Ls > up) & (Ls > dn) & (lnn < 0)
    trough = (Ls < up) & (Ls < dn) & (lnn > 0)
    live = (coh > p["coherence_min"])

    # Crests and troughs are seeded separately. Sharing one threshold and one
    # suppression window lets a loaded impasto ridge suppress the reed-pen
    # contour lying against it, and on this canvas that is the whole figure:
    # the reaper is drawn in dark blue outline against wheat that shouts.
    sp = int(p["seed_spacing"])
    ok = np.zeros_like(live)
    for mask in (crest & live, trough & live):
        if not mask.any():
            continue
        thr = np.percentile(strength[mask], p["seed_strength_pct"])
        m = mask & (strength >= thr)
        masked = np.where(m, strength, -np.inf)
        ok |= m & (masked >= maximum_filter(masked, size=2 * sp + 1))

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
    Ls, coh, tx, ty, lab = fields
    h, w = Ls.shape
    n = len(x0)
    nsteps = int(p["max_arc"] / 2 / p["step"]) + 2
    step, rec = float(p["step"]), float(p["recentre"])

    px = np.zeros((n, nsteps), np.float32)
    py = np.zeros((n, nsteps), np.float32)
    px[:, 0], py[:, 0] = x0, y0
    live = np.ones(n, bool)
    count = np.ones(n, np.int32)
    spill = np.zeros(n, bool)
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
        prof = map_coordinates(Ls, [sy.ravel(), sx.ravel()], order=1,
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
        # a 1024 px cap -- and the cap is what has to clear M0b's tile overlap,
        # or long strokes acquire a seam at every tile boundary.
        arc[idx] += np.hypot(nxs - cx, nys - cy)

        turn = np.abs(np.arctan2(ux * cdy - uy * cdx, ux * cdx + uy * cdy))
        total_turn[idx] += turn
        c = samp(coh, nxs, nys)
        dlab = samp3(lab, nxs, nys) - lab0[idx]
        de = np.sqrt((dlab ** 2).sum(-1))
        inside = (nxs > 1) & (nxs < w - 2) & (nys > 1) & (nys < h - 2)

        keep = inside & (turn < p["max_turn"]) & (c > p["coherence_min"]) \
            & (de < p["de_max"]) & (total_turn[idx] < p["max_total_turn"]) \
            & (arc[idx] < half_cap)

        x[idx], y[idx] = nxs, nys
        dx[idx], dy[idx] = ux, uy
        px[idx, s] = nxs
        py[idx, s] = nys
        count[idx] += keep
        spill[idx[~inside]] = True
        live[idx[~keep]] = False

    return px, py, count, spill


def trace_all(xs, ys, pol, fields, p):
    fwd = walk(xs, ys, pol, +1.0, fields, p)
    bwd = walk(xs, ys, pol, -1.0, fields, p)
    lines, spill = [], []
    for i in range(len(xs)):
        nb, nf = bwd[2][i], fwd[2][i]
        bx, by = bwd[0][i, :nb][::-1], bwd[1][i, :nb][::-1]
        fx, fy = fwd[0][i, 1:nf], fwd[1][i, 1:nf]
        lines.append(np.stack([np.concatenate([bx, fx]),
                               np.concatenate([by, fy])], 1))
        spill.append(bool(bwd[3][i] or fwd[3][i]))
    return lines, np.array(spill)


# ------------------------------------------------------------- dedup/merge --

def arclen(pts):
    return float(np.hypot(*np.diff(pts, axis=0).T).sum()) if len(pts) > 1 else 0.0


def dedup(lines, strength, widths, shape, p, eligible):
    """One stroke found from two seeds is one stroke. Claim in strength order.

    Only ever considers traces that passed the earlier filters -- an earlier
    draft walked every index in the array, so traces already rejected for being
    stubs or for lying in a shadow came back in here, and the merge removed
    almost nothing.
    """
    h, w = shape
    claimed = np.zeros((h, w), bool)
    angle = np.zeros((h, w), np.float32)
    keep = []
    elig = np.array(sorted(eligible, key=lambda i: -strength[i]), np.int64)
    for i in elig:
        pts = lines[i]
        if len(pts) < 3:
            continue
        d = np.gradient(pts, axis=0)
        th = np.arctan2(d[:, 1], d[:, 0])
        xi = np.clip(pts[:, 0].astype(np.int32), 0, w - 1)
        yi = np.clip(pts[:, 1].astype(np.int32), 0, h - 1)
        hit = claimed[yi, xi]
        if hit.any():
            da = np.abs(np.angle(np.exp(1j * (angle[yi, xi] - th))))
            da = np.minimum(da, np.pi - da)
            frac = float((hit & (da < p["dedup_angle"])).mean())
            if frac > p["dedup_frac"]:
                continue
        keep.append(i)
        # stamp a band narrower than the stroke, so crossings stay legal
        band = np.linspace(-1, 1, 9) * (p.get("dedup_band", 0.45) * widths[i])
        ax, ay = -np.sin(th), np.cos(th)
        sx = np.clip((pts[:, 0:1] + ax[:, None] * band).astype(np.int32), 0, w - 1)
        sy = np.clip((pts[:, 1:2] + ay[:, None] * band).astype(np.int32), 0, h - 1)
        claimed[sy, sx] = True
        angle[sy, sx] = th[:, None]
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


def stroke_width(pts, Ls, pol, p):
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
    prof = map_coordinates(Ls, [sy.ravel(), sx.ravel()], order=1,
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
    dark ribbons lying in its own shadows.
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


def stroke_colour_height(pts, srgb, hfield, width, p):
    """Median (never mean: the mean eats the neighbour at every crossing)."""
    m = max(1, len(pts) // 24)
    q = pts[::m]
    d = np.gradient(q, axis=0) if len(q) > 2 else np.diff(q, axis=0, prepend=q[:1])
    th = np.arctan2(d[:, 1], d[:, 0])
    ax, ay = -np.sin(th), np.cos(th)
    band = np.linspace(-1, 1, 7, dtype=np.float32) * (width * p["colour_band"])
    sx = (q[:, 0:1] + ax[:, None] * band).ravel()
    sy = (q[:, 1:2] + ay[:, None] * band).ravel()
    cols = samp3(srgb, sx, sy)
    return (np.median(cols, axis=0),
            float(np.median(map_coordinates(hfield, [sy, sx], order=1, mode="nearest"))))


# ------------------------------------------------------------------- main --

def params_hash(p):
    clean = {k: v for k, v in sorted(p.items()) if not k.startswith("_")}
    return hashlib.sha256(json.dumps(clean, sort_keys=True).encode()).hexdigest()


def file_sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def working_image(p, src):
    """Downsample to the working resolution once and cache it (BUILD.md)."""
    cache = os.path.join(ROOT, "ref", "work", p["slug"] + ".npy")
    if os.path.exists(cache):
        return np.load(cache, mmap_mode="r")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(src).convert("RGB")
    w = int(round(p["canvas_cm"][0] * p["px_per_cm"]))
    h = int(round(im.size[1] * w / im.size[0]))
    a = np.asarray(im.resize((w, h), Image.LANCZOS))
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    np.save(cache, a)
    return np.load(cache, mmap_mode="r")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--tile", default=None)
    ap.add_argument("--out", default="strokes/m0a")
    args = ap.parse_args()

    t_start = time.time()
    p = json.load(open(os.path.join(ROOT, "params", args.slug + ".json")))
    tile_name = args.tile or p["tile"]
    x0, y0, tw, th = p["tiles"][tile_name]
    src = os.path.join(ROOT, p["source"])

    full = working_image(p, src)
    cw, ch = full.shape[1], full.shape[0]
    rgb8 = np.ascontiguousarray(full[y0:y0 + th, x0:x0 + tw])
    print(f"tile {tile_name} {tw}x{th} at ({x0},{y0}) of {cw}x{ch}"
          f"  [{x0/p['px_per_cm']:.1f}-{(x0+tw)/p['px_per_cm']:.1f} cm, "
          f"{y0/p['px_per_cm']:.1f}-{(y0+th)/p['px_per_cm']:.1f} cm]", flush=True)

    lin = srgb_to_linear(rgb8)
    L = lightness(lin)
    lab = linear_to_lab(gaussian_filter(lin, (p["sigma_ridge"], p["sigma_ridge"], 0)))

    t = time.time()
    nx, ny, coh = structure_tensor(L, p["sigma_grad"], p["sigma_tensor"])
    tx, ty = -ny, nx                                   # along the stroke
    Ls, lnn = ridge_field(L, p["sigma_ridge"], nx, ny)
    hfield = Ls - gaussian_filter(L, p["sigma_height"])
    print(f"  fields {time.time()-t:.1f}s   coherence mean {coh.mean():.3f}", flush=True)

    t = time.time()
    sx, sy, pol, strength = find_seeds(Ls, lnn, coh, nx, ny, p)
    print(f"  {len(sx)} seeds {time.time()-t:.1f}s", flush=True)

    t = time.time()
    lines, spill = trace_all(sx, sy, pol, (Ls, coh, tx, ty, lab), p)
    print(f"  traced {time.time()-t:.1f}s", flush=True)

    t = time.time()
    keep0 = [i for i in range(len(lines)) if arclen(lines[i]) >= p["min_arc"]]
    widths = np.zeros(len(lines), np.float32)
    for i in keep0:
        widths[i] = stroke_width(lines[i], Ls, pol[i], p)
    shadow = [i for i in keep0 if pol[i] < 0
              and not trough_is_paint(lines[i], lab, widths[i], p)]
    keep0 = [i for i in keep0 if i not in set(shadow)]
    print(f"  {len(shadow)} dark traces dropped as shadow between strokes", flush=True)
    kept = dedup(lines, strength, widths, L.shape, p, keep0)
    print(f"  {len(kept)} traces after merge {time.time()-t:.1f}s", flush=True)

    t = time.time()
    out = []
    for i in kept:
        pts, wid = lines[i], float(widths[i])
        tol = p["fit_tol_frac"] * wid
        arcs = fit_chain(pts, tol, int(p["fit_max_split"]), p["min_arc"])
        for j, (seg, bez) in enumerate(arcs):
            if arclen(seg) < p["min_arc"] * 0.5:
                continue
            col, hgt = stroke_colour_height(seg, rgb8, hfield, wid, p)
            out.append(dict(
                bez=bez, colour=col, width=wid, height=hgt,
                arc=arclen(seg), polarity=float(pol[i]),
                chain=1 if j < len(arcs) - 1 else 0,
                spill=1 if spill[i] else 0))
    print(f"  {len(out)} strokes after fit {time.time()-t:.1f}s", flush=True)

    # heuristic order (M0a): thin and dark before thick and light
    wv = np.array([s["width"] for s in out], np.float32)
    lv = np.array([lightness(srgb_to_linear(s["colour"][None, :]))[0] for s in out], np.float32)
    rank = lambda a: np.argsort(np.argsort(a)) / max(1, len(a) - 1)
    score = 0.5 * rank(wv) + 0.5 * rank(lv)
    seq = np.argsort(score)
    ordv = np.zeros(len(out), np.float32)
    ordv[seq] = np.arange(len(out)) / max(1, len(out) - 1)

    hv = np.array([s["height"] for s in out], np.float32)
    lo, hi = (np.percentile(hv, 5), np.percentile(hv, 98)) if len(hv) else (0, 1)
    hn = np.clip((hv - lo) / max(hi - lo, EPS), 0, 1)

    med_w = float(np.median(wv)) if len(wv) else 1.0
    recs = []
    for k, s in enumerate(out):
        pol_dark = s["polarity"] < 0
        flags = (1 if (pol_dark and s["width"] < 0.7 * med_w) else 0)          # contour
        flags |= (2 if (not pol_dark and lv[k] > np.percentile(lv, 85)
                        and hn[k] > 0.6) else 0)                               # highlight
        flags |= (4 if s["chain"] else 0)                                      # chain
        flags |= (8 if s["spill"] else 0)                                      # edge-spill
        b = s["bez"] + np.array([x0, y0], np.float32)
        recs.append(dict(
            p=[[float(b[i, 0] / cw), float(b[i, 1] / ch)] for i in range(3)],
            rgb=[int(v) for v in s["colour"]],
            w=float(s["width"] / min(cw, ch)),
            h=float(hn[k]), o=float(ordv[k]), act=0, flags=int(flags),
            depth=0.0, arc=float(s["arc"])))

    os.makedirs(os.path.join(ROOT, args.out), exist_ok=True)
    dest = os.path.join(ROOT, args.out, f"{args.slug}-{tile_name}.json")
    json.dump(dict(
        slug=args.slug, tile=tile_name, tile_rect=[x0, y0, tw, th],
        canvas_px=[cw, ch], canvas_cm=p["canvas_cm"], px_per_cm=p["px_per_cm"],
        source=p["source"], source_sha256=file_sha256(src),
        params_sha256=params_hash(p), height_method=0,
        height_mm=p.get("height_mm", 2.4),
        strokes=recs), open(dest, "w"))

    arcs = np.array([r["arc"] for r in recs])
    cov = coverage(recs, cw, ch, x0, y0, tw, th)
    el = time.time() - t_start
    print(f"\n  strokes            {len(recs)}            (M0a target 300-1500)")
    print(f"  mean arc length    {arcs.mean():.0f} px   "
          f"= {arcs.mean()/p['px_per_cm']*10:.1f} mm   (target 250-700 px)")
    print(f"  median arc         {np.median(arcs):.0f} px")
    print(f"  mean width         {med_w:.0f} px   = {med_w/p['px_per_cm']*10:.1f} mm")
    print(f"  coverage           {cov*100:.1f}%          (target >= 75%)")
    print(f"  wall time          {el:.0f} s          (target <= 120 s)")
    print(f"  -> {os.path.relpath(dest, ROOT)}")


def coverage(recs, cw, ch, x0, y0, tw, th):
    """Fraction of the tile inside some stroke's footprint, rasterised solid."""
    cov = np.zeros((th, tw), bool)
    for r in recs:
        p0, p1, p2 = (np.array(q, np.float32) * [cw, ch] - [x0, y0] for q in r["p"])
        wpx = r["w"] * min(cw, ch)
        n = max(8, int(r["arc"]))
        t = np.linspace(0, 1, n, dtype=np.float32)[:, None]
        pts = (1 - t) ** 2 * p0 + 2 * t * (1 - t) * p1 + t ** 2 * p2
        d = np.gradient(pts, axis=0)
        a = np.arctan2(d[:, 1], d[:, 0])
        off = np.linspace(-0.5, 0.5, max(4, int(wpx)), dtype=np.float32) * wpx
        xs = np.clip((pts[:, 0:1] - np.sin(a)[:, None] * off).astype(np.int32), 0, tw - 1)
        ys = np.clip((pts[:, 1:2] + np.cos(a)[:, None] * off).astype(np.int32), 0, th - 1)
        cov[ys, xs] = True
    return float(cov.mean())


if __name__ == "__main__":
    main()
