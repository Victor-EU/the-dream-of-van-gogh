#!/usr/bin/env python3
"""Impasto height from the stroke's own cross-profile.

DESIGN.md 4.1 step 6 derives height from local luminance above a wide
neighbourhood. That is measuring colour, not geometry: it gives every
light-on-dark passage relief and every dark-on-light passage a dent, and the
result looks like Van Gogh moulded in plastic. BUILD.md M1 replaces it, and this
is the replacement.

The signal that carries relief is the profile *across* the stroke, sampled
perpendicular to its own direction and averaged along its length. Two cues:

  antisymmetric   one flank lit, the other shaded. The amplitude is the flank's
                  slope times the rig's sensitivity, projected onto the light:
                  k * (l . n). Depends on the stroke's orientation, so it
                  vanishes for strokes lying along the light.
  symmetric       both feet darkened where the ridge meets the canvas. Nothing
                  about a uniformly loaded stroke's pigment can darken the paint
                  on *both* sides below the ground it sits on, so this one is
                  relief by construction -- and it survives cross-lighting,
                  which the antisymmetric cue does not.

Three things make this honest rather than wishful:

**Centring.** The luminance crest of a lit ridge sits off the geometric crest,
towards the light. Centre the profile there and the antisymmetric part is
destroyed by construction. So the centre is the midpoint of the two *feet* --
where the paint ends, which is geometry -- found by the same descent-to-the-gap
walk that `extract.stroke_width` uses, and validated the same way.

**The background ramp.** A stroke lying across a tonal gradient shows an
antisymmetric profile that is entirely composition. A linear ramp fitted to the
two outer bands, beyond the paint, and subtracted, removes it exactly; a
localised relief signal survives it, because relief returns to zero outside the
stroke and a gradient does not.

**The light must agree.** Whatever residual bias the centring has, it is a
function of the profile's own shape and has no preferred direction in the
canvas. Only a real light does. So `solve_light` is both the estimator and the
test: the resultant R of the amplitude-weighted normals is near zero if we are
measuring nothing, and the direction has to agree across canvases shot on the
same rig. `tools/light_audit.py` runs that comparison.
"""
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

EPS = 1e-12

STATIONS = 16               # samples along the stroke
VSPAN = 3.0                 # profile reaches this many half-widths either side
VN = 81                     # samples across it
VG = np.linspace(-VSPAN, VSPAN, VN, dtype=np.float32)
OUTER = 2.4                 # |v| beyond this is background on the first pass
FLANK = (0.35, 0.95)        # where the antisymmetric shading lives, in feet
FOOT = (1.05, 1.45)         # where the ridge meets the cloth
BACK = (1.55, 2.10)         # and where the cloth is only cloth
VK = np.concatenate([np.linspace(*FLANK, 10), np.linspace(*FOOT, 8),
                     np.linspace(*BACK, 8)]).astype(np.float32)
NF, NS = 10, 18             # flank ends at NF, foot ends at NS


# ------------------------------------------------------------- the surface --

def surface(work, sigma, band=4096):
    """Lightly-smoothed linear luminance of the whole canvas, float16, banded.

    Light, because the cues live at the scale of a stroke's flank: the ridge
    field's sigma (14 px here) would erase both of them. Banded because the
    canvas is 98 MP and this is not the only plane alive at the time; float32
    because the profile is sampled by interpolation and float16 would be
    converted per block anyway.
    """
    H, W = work.shape[:2]
    pad = int(3 * sigma) + 2
    out = np.empty((H, W), np.float32)
    for y in range(0, H, band):
        y1 = min(H, y + band)
        a, b = max(0, y - pad), min(H, y1 + pad)
        rgb = np.asarray(work[a:b], np.float32) / 255.0
        lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
        lum = (0.2126729 * lin[..., 0] + 0.7151522 * lin[..., 1]
               + 0.0721750 * lin[..., 2])
        out[y:y1] = gaussian_filter(lum, sigma)[y - a:y1 - a]
        del rgb, lin, lum
    return out


def stations(pts, n=STATIONS):
    """n evenly-spaced points along a trace, with the unit normal at each."""
    s = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
    if s[-1] < EPS:
        return None
    u = np.linspace(0.0, s[-1], n)
    q = np.stack([np.interp(u, s, pts[:, 0]), np.interp(u, s, pts[:, 1])], 1)
    d = np.gradient(q, axis=0)
    L = np.maximum(np.hypot(d[:, 0], d[:, 1]), EPS)
    return q.astype(np.float32), np.stack([-d[:, 1] / L, d[:, 0] / L], 1).astype(np.float32)


# ------------------------------------------------------------ the profiles --

def _sample(surf, P, N, hw, block=1 << 21):
    """Profile at every station: (T, VN), in whatever units the surface is."""
    T = len(P)
    prof = np.empty((T, VN), np.float32)
    for i in range(0, T, block // VN):
        j = min(T, i + block // VN)
        u = VG[None, :] * hw[i:j, None]
        sx = P[i:j, 0:1] + N[i:j, 0:1] * u
        sy = P[i:j, 1:2] + N[i:j, 1:2] * u
        prof[i:j] = map_coordinates(surf, [sy.ravel(), sx.ravel()], order=1,
                                    mode="nearest").reshape(j - i, VN)
    return prof


def _feet(q, drop):
    """Centre and half-width of the paint, from the descent to the gap either side.

    Vectorised form of the walk in `extract.stroke_width`: from the middle, keep
    a running maximum, and stop at the first sample that is `drop` of the local
    range below it and is already rising again -- the shadowed gap between this
    stroke and the next. A stroke that reaches the window's edge without one
    keeps the edge, which is the same fallback that function takes.
    """
    mid = VN // 2
    rng = np.maximum(q.max(1) - q.min(1), EPS)[:, None]
    out = []
    for side in (1, -1):
        r = q[:, mid:] if side > 0 else q[:, mid::-1]
        run = np.maximum.accumulate(r, axis=1)
        rise = np.diff(r, axis=1, append=r[:, -1:]) > 0
        ok = ((run - r) >= drop * rng) & rise
        ok[:, -1] = True                                   # the edge as fallback
        idx = np.argmax(ok, axis=1)
        out.append(VG[mid + side * idx])
    vR, vL = out
    return (np.clip(0.5 * (vL + vR), -0.6, 0.6),
            np.clip(0.5 * (vR - vL), 0.35, 1.35))


def cues(surf, P, N, hw, pol, drop=0.22):
    """The two cues at every station.

    Returns (anti, sym, hv, live). `anti` is the flank asymmetry in units of the
    local background; `sym` is how much darker the two feet are than the cloth
    just beyond them, so positive means a ridge sitting on the canvas and
    negative means there is nothing there. `hv` is where the paint actually
    ended, in units of the half-width it was told to expect -- 1.0 means the
    extractor's width and this profile agree.

    Two passes over the same samples, because the background cannot be located
    until the paint has been, and the paint cannot be found through a tonal
    gradient. So: remove a provisional ramp fitted at the far edge of the
    window, find the feet, then re-fit the ramp *outside those feet* and take
    the cues against that. One resample, two arithmetic passes.
    """
    prof = _sample(surf, P, N, hw)
    inL, inR = VG <= -OUTER, VG >= OUTER
    oL, oR = prof[:, inL].mean(1), prof[:, inR].mean(1)
    bg = 0.5 * (oL + oR)
    live = bg > 1e-4
    q = prof / np.maximum(bg, 1e-4)[:, None] - 1.0
    mv = float(np.abs(VG[inR]).mean())
    q -= ((oR - oL) / np.maximum(bg, 1e-4) / (2 * mv))[:, None] * VG[None, :]
    q -= (0.5 * (oL + oR) / np.maximum(bg, 1e-4) - 1.0)[:, None]

    vc, hv = _feet(q * pol[:, None], drop)
    rows = np.repeat(np.arange(len(q), dtype=np.float32)[:, None], len(VK), 1)
    at = lambda v: map_coordinates(
        q, [rows.ravel(), ((np.clip(v, -VSPAN, VSPAN) + VSPAN)
                           / (2 * VSPAN) * (VN - 1)).ravel()],
        order=1, mode="nearest").reshape(v.shape)
    vp = vc[:, None] + VK[None, :] * hv[:, None]
    vm = vc[:, None] - VK[None, :] * hv[:, None]
    qp, qm = at(vp), at(vm)
    # the composition, removed properly this time: the ramp that fits the cloth
    # on both sides of *this* stroke. A tonal gradient across a stroke is a
    # straight line through it; relief is not, because relief comes back to the
    # cloth on both sides, and that is the whole difference between the two.
    bL, bR = qm[:, NS:].mean(1), qp[:, NS:].mean(1)
    base, tilt = 0.5 * (bL + bR), 0.5 * (bR - bL) / float(VK[NS:].mean())
    qp = qp - base[:, None] - tilt[:, None] * VK[None, :]
    qm = qm - base[:, None] + tilt[:, None] * VK[None, :]

    anti = (0.5 * (qp - qm))[:, :NF].mean(1)
    sym = -(0.5 * (qp + qm))[:, NF:NS].mean(1)
    return anti, sym, hv, live


# ---------------------------------------------------------------- the light --

def solve_light(anti, N, live=None):
    """Direction of the rig's net light, and how much the canvas agrees on it.

    Each station votes with its own normal, weighted by its flank asymmetry:
    a stroke lit from the left is bright on its left flank whichever way it was
    traced, because reversing the trace flips the normal and the sign together.
    So the sum of anti * n is the light, and the resultant

        R = |sum anti_j n_j| / sum |anti_j|

    is the whole test. R near zero means the votes cancel -- the rig is
    cross-lit and the antisymmetric cue is measuring nothing. For n independent
    votes of random direction R lands near sqrt(pi)/(2 sqrt(n)), which at these
    counts is well under a percent, so the number that matters is not whether R
    beats chance but whether the *direction* is the same on the next canvas off
    the same rig.
    """
    m = np.isfinite(anti) if live is None else (live & np.isfinite(anti))
    a, n = anti[m], N[m]
    if not len(a):
        return np.array([1.0, 0.0], np.float32), 0.0, 0
    v = (a[:, None] * n).sum(0)
    tot = np.abs(a).sum()
    R = float(np.hypot(*v) / max(tot, EPS))
    if R < EPS:
        return np.array([1.0, 0.0], np.float32), 0.0, int(m.sum())
    return (v / np.hypot(*v)).astype(np.float32), R, int(m.sum())


def chance_R(n):
    return float(np.sqrt(np.pi) / (2.0 * np.sqrt(max(n, 1))))


# --------------------------------------------------------------- the height --

def per_stroke(anti, sym, N, live, per, light, clip=4.0):
    """Fold the stations of each stroke into one number for each cue.

    The antisymmetric amplitude at a station is k * (l . n), so a stroke's k is
    a one-parameter least squares over its own stations -- which handles a
    curving stroke exactly, since every station carries its own geometry, and
    hands back the precision sum(c^2) as the weight. That weight goes to zero
    for a stroke lying along the light, which is precisely the stroke the
    antisymmetric cue cannot see.
    """
    S = len(anti) // per
    c = np.where(live, (N @ light).astype(np.float32), 0.0)
    a = np.where(live, anti, 0.0).astype(np.float32)
    sd = float(np.median(np.abs(a[live])) * 1.4826) if live.any() else 1.0
    a = np.clip(a, -clip * sd, clip * sd)                  # a crossing, not a flank
    num = (a * c).reshape(S, per).sum(1)
    den = (c * c).reshape(S, per).sum(1)
    with np.errstate(invalid="ignore"):
        sy = np.nanmedian(np.where(live, sym, np.nan).reshape(S, per), axis=1)
    return num / np.maximum(den, EPS), np.nan_to_num(sy), den


def measured(k, sy, den, sym_w):
    """Height method 1: relief as the two cues actually measure it.

    Kept selectable, and not the default, because M1 measured what it is worth:
    on these scans the antisymmetric cue is coherent across the museum's
    canvases and about thirty times too weak to give a single stroke a height,
    and the symmetric cue is dominated by the ridge finder's own selection --
    a bright ridge is picked *because* its neighbours are lower. Anyone can
    re-run it with --height 1 and see the speckle for themselves.
    """
    strong = den > np.percentile(den, 70)
    rho = float((sy[strong] * k[strong]).sum()
                / max(float((k[strong] ** 2).sum()), EPS)) if strong.any() else 1.0
    rho = rho if abs(rho) > EPS else 1.0
    w = den / max(float(np.median(den)), EPS)
    return (w * k + sym_w * (sy / rho)) / (w + sym_w)


def model(width, stack, p):
    """Height method 2: relief from geometry, because colour is not relief.

    Nothing here looks at the palette, which is the whole point -- DESIGN 4.1
    step 6's estimate is local luminance above a wide neighbourhood, and that
    gives every light-on-dark stroke relief and every dark-on-light stroke a
    dent whether or not there is paint standing there. False-colour that field
    over the Reaper and the sheaves are legible in it: it is a picture of the
    palette. BUILD.md M1's gate is that `?heights` must show relief following
    the paint, and an estimate that never reads a colour passes it by
    construction.

    Paint adds. A stroke stands as high as the film it lays down plus whatever
    it was laid on top of, so the two terms are a sum and not a product:

      its own film       goes with its width, because a fatter and more heavily
                         loaded brush leaves more behind it.
      what is underneath the paint already at that place, which the raster sums
                         as it draws -- each footprint contributing its own
                         width. This is a fact of the extraction rather than an
                         assumption about the painting.

    Multiplying them instead, which is where this started, gives a big isolated
    loaded mark almost no height at all, because nothing crosses it. On the
    Reaper that is precisely the sheaves.

    The constants are fixed against the one anchor here that is physical rather
    than aesthetic: **the height-to-width aspect of a paint ridge.** Ordinary
    brushed oil sits near 0.03-0.05 of its own width, loaded impasto reaches
    0.15-0.25, and M0a found the far end the hard way with 4 mm on an 8 mm
    stroke -- every mark taller than it was wide.

    It is a model and the blob header says so, method 2. The honest statement of
    this milestone is that the relief is *plausible* and *consistent*, never
    that it is measured; what would make it measured is raking-light or
    photometric-stereo height data, and no scan in this set carries any.
    """
    w = np.asarray(width, np.float32)
    w = np.clip(w / max(float(np.percentile(w, 99.5)), EPS), 0.0, 1.0)
    h = (np.power(w, float(p["relief_width_pow"]))
         + float(p["relief_stack_w"]) * np.asarray(stack, np.float32))
    f = float(p["relief_floor"])
    return f + (1.0 - f) * np.clip(h / max(float(np.percentile(h, 99.5)), EPS), 0, 1)
