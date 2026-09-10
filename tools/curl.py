#!/usr/bin/env python3
"""Whether a stroke can move along its own curl. DESIGN.md 4.5's one motion.

The sentence being tested is short: *the Starry Night spirals turn along their
own curl, each at its own rate, which is a per-stroke rotation about its arc
centre and nothing like a scrolling texture.* Three claims, and all three are
about the canvas rather than about the renderer.

**A stroke has an arc centre.** Every stroke is a quadratic through three
points, so the circle through its two ends and its midpoint gives a centre, a
radius and a total turn. A straight stroke has no centre worth having, and the
turn is what says which is which. Nothing here is fitted: the arc is already in
the record and this only reads it.

**The paint ahead of a stroke on its own arc is its own colour.** This is the
one that matters, because it is what decides whether the motion is invisible or
a disaster. Slide a stroke along its own arc and sample the scan under it: as
long as the colour it lands on is a colour it could have been traced from, the
picture survives the motion. The moment it is not, a mark is swimming through
paint that belongs to something else, which is the failure the design means by
*shimmer*. So the measurement is a distance -- **how far a stroke can slide
before it stops matching**, per stroke -- and that distance is the amplitude the
runtime is allowed. It is not a tuning constant; it is packed per stroke.

  The threshold is the extractor's own `de_max`. That is not a new number and
  it is the right one: it is the colour tolerance the tracer used to decide
  that a piece of paint belonged to this stroke in the first place, so
  "still matching" means exactly "would still have been traced as me".

**And it must beat sliding straight.** A translation along the stroke is a
scrolling texture, which is the thing DESIGN 4.5 says this is nothing like. So
the same slide is measured three ways for every stroke -- along its own arc,
along the arc mirrored through its midpoint (same radius, same speed, wrong
curl), and straight along its tangent -- and the claim is only worth anything
if the first beats the third.

**Pre-registered, before the first canvas was run.** On the Starry Night the
median coherence length along the arc must beat the tangent by **1.3x** among
strokes that actually turn, and the ratio must *grow* with the turn: a stroke
that barely bends cannot tell the two apart and must not pretend to. Two
canvases that are full of curved strokes and are not vortices are run through
the same code as controls -- a bed of irises, which the Getty's own catalogue
entry describes as "wavy, twisting, and curling lines", and a self-portrait,
whose halo of dashes is the densest curved field in the collection. If a
control clears the same bar, the bar is wrong and the controls reset it, which
is what happened to the horizon threshold at M3.

**A vortex is not a field of squiggles.** The second structural question is
whether neighbouring strokes agree about where the centre is, because that is
the difference between one turning sky and eleven thousand independent
wobbles. Measured as the distance between a stroke's centre and its nearest
curved neighbour's, in units of its own radius, against a null that permutes
which stroke got which curvature and keeps everything else.

**What is not measured, and is therefore invention: the rate.** There is no
time in a painting. One global period is chosen in the station file and every
per-stroke number under it -- amplitude, phase, direction -- comes from this
measurement or from the stroke's own geometry.

    tools/curl.py strokes/s08/starry-canvas.json
    tools/curl.py strokes/s08/starry-canvas.json --audit     # measure, write nothing
"""
import argparse, json, math, os, sys, time
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import extract as E                                          # noqa: E402

EPS = 1e-12
NPT = 7                       # samples along a stroke's centreline
FMAX = 2.0                    # slide out to twice the stroke's own length
NF = 33                       # and in steps of a sixteenth of it
TURN_MIN = 0.25               # rad. below this a stroke does not turn enough to tell
                              # its arc from its tangent, and is excluded from the ratio
BINS = (0.0, 0.10, 0.25, 0.50, 1.00, 9.9)     # total turn, rad
SHUF = 40                     # permutations for the centre-agreement null
RATIO_MIN = 1.3               # pre-registered: arc over tangent, strokes that turn
SEED = 18531890


# ------------------------------------------------------------------- the arc --

def arcs(doc):
    """Centre, radius, turn and tangent for every stroke, in scan pixels.

    The circle is through the two ends and the curve's own midpoint, all three
    of which are on the stroke; the middle control point is not, and using it
    would put the centre in the wrong place by a factor of two on a tight bend.
    """
    P = np.array([r["p"] for r in doc["strokes"]], np.float64)      # n,3,2
    cw, ch = doc["canvas_px"]
    Q = P * np.array([cw, ch], np.float64)
    A, C = Q[:, 0], Q[:, 2]
    M = 0.25 * Q[:, 0] + 0.5 * Q[:, 1] + 0.25 * Q[:, 2]             # B(1/2)

    ax, ay = A[:, 0], A[:, 1]
    mx, my = M[:, 0], M[:, 1]
    cx, cy = C[:, 0], C[:, 1]
    d = 2.0 * (ax * (my - cy) + mx * (cy - ay) + cx * (ay - my))
    sa, sm, sc = ax * ax + ay * ay, mx * mx + my * my, cx * cx + cy * cy
    with np.errstate(divide="ignore", invalid="ignore"):
        ux = (sa * (my - cy) + sm * (cy - ay) + sc * (ay - my)) / d
        uy = (sa * (cx - mx) + sm * (ax - cx) + sc * (mx - ax)) / d
    cen = np.stack([ux, uy], -1)
    r = np.hypot(ux - ax, uy - ay)
    straight = ~np.isfinite(r) | (np.abs(d) < EPS)
    r = np.where(straight, np.inf, r)

    arc = np.array([s["arc"] for s in doc["strokes"]], np.float64)  # px
    turn = np.where(straight, 0.0, arc / np.maximum(r, EPS))

    # B'(1/2) of a quadratic is exactly the chord, which is why the tangent at
    # the midpoint costs nothing to know.
    T = C - A
    T = T / np.maximum(np.hypot(T[:, 0], T[:, 1]), EPS)[:, None]
    return dict(P=Q, mid=M, cen=cen, r=r, turn=turn, tan=T, arc=arc,
                straight=straight)


def curve_points(Q, n=NPT):
    """n points along each quadratic, ends included."""
    t = np.linspace(0.0, 1.0, n)[None, :, None]
    a = (1 - t) ** 2
    b = 2 * (1 - t) * t
    c = t ** 2
    return a * Q[:, 0][:, None] + b * Q[:, 1][:, None] + c * Q[:, 2][:, None]


# ----------------------------------------------------------------- the slide --

def _rotate(pts, cen, th):
    """Rotate n x k points about n centres by n angles."""
    d = pts - cen[:, None, :]
    c, s = np.cos(th)[:, None], np.sin(th)[:, None]
    return np.stack([cen[:, None, 0] + c * d[..., 0] - s * d[..., 1],
                     cen[:, None, 1] + s * d[..., 0] + c * d[..., 1]], -1)


def displaced(a, pts, s, kind):
    """Move each stroke's sample points by arc-length s, three ways.

    `arc` turns the stroke about its own centre, so it stays tangent to the
    curve it draws. `mirror` turns it about that centre reflected through the
    stroke's midpoint -- the same radius and the same displacement of the
    midpoint, and the opposite curl. `line` slides it along its tangent, which
    is the scrolling texture.
    """
    if kind == "line":
        return pts + (a["tan"] * s[:, None])[:, None, :]
    cen = a["cen"] if kind == "arc" else 2.0 * a["mid"] - a["cen"]
    rad = a["mid"] - cen
    # which way round the centre moves the midpoint along its own tangent
    sgn = np.sign(-rad[:, 1] * a["tan"][:, 0] + rad[:, 0] * a["tan"][:, 1])
    sgn = np.where(sgn == 0, 1.0, sgn)
    th = np.where(np.isfinite(a["r"]), sgn * s / np.maximum(a["r"], EPS), 0.0)
    out = _rotate(pts, cen, th)
    # a straight stroke has no centre; it slides along itself, which is the
    # same motion under any of the three names and is the correct limit.
    st = a["straight"]
    if st.any():
        out[st] = pts[st] + (a["tan"][st] * s[st, None])[:, None, :]
    return out


def sample_lab(img, lut, pts, shape):
    """Lab of the scan under each sample point; off the canvas is a mismatch."""
    h, w = shape
    x = np.rint(pts[..., 0]).astype(np.int64)
    y = np.rint(pts[..., 1]).astype(np.int64)
    ok = (x >= 0) & (x < w) & (y >= 0) & (y < h)
    xi = np.clip(x, 0, w - 1)
    yi = np.clip(y, 0, h - 1)
    rgb = np.asarray(img[yi.ravel(), xi.ravel()], np.int32)
    qi = (rgb[:, :3] * 31 + 127) // 255            # quantised per sample, not per pixel
    lab = lut[qi[:, 0], qi[:, 1], qi[:, 2]].reshape(pts.shape[:-1] + (3,))
    return lab, ok


def lab_lut():
    """A 32^3 lookup, because four million sample points is four million
    conversions and the quantisation is a tenth of the threshold."""
    g = (np.arange(32) * 255.0 / 31.0)
    r, gg, b = np.meshgrid(g, g, g, indexing="ij")
    rgb = np.stack([r, gg, b], -1)[None]                     # 0..255
    return E.linear_to_lab(E.srgb_to_linear(rgb))[0]


def slide(doc, p, img):
    """Coherence length per stroke, three motions, in stroke lengths."""
    a = arcs(doc)
    pts = curve_points(a["P"])
    n = len(pts)
    own = np.array([s["rgb"] for s in doc["strokes"]], np.float64)[None]
    own = E.linear_to_lab(E.srgb_to_linear(own))[0]

    lut = lab_lut()
    shape = img.shape[:2]
    de_max = float(p["de_max"])

    fr = np.linspace(0.0, FMAX, NF)
    out, censored, de0 = {}, {}, None
    for kind in ("arc", "mirror", "line"):
        curve = np.empty((NF, n))
        for i, f in enumerate(fr):
            s = f * a["arc"]
            lab, ok = sample_lab(img, lut, displaced(a, pts, s, kind), shape)
            de = np.sqrt(((lab - own[:, None, :]) ** 2).sum(-1))
            curve[i] = np.median(np.where(ok, de, 1e3), 1)
        if de0 is None:
            de0 = curve[0].copy()
        # the first crossing of the tracer's tolerance, interpolated, so the
        # answer is a distance rather than a bin of the step it was sampled at
        over = curve > de_max
        first = np.where(over.any(0), over.argmax(0), NF)
        out[kind] = _cross(fr, curve, first, de_max)
        censored[kind] = float((first >= NF).mean())
    return a, out, de0, censored


def _cross(fr, curve, first, thr):
    """Where the coherence curve crosses the tolerance, linearly interpolated."""
    n = curve.shape[1]
    j = np.clip(first, 1, len(fr) - 1)
    lo, hi = curve[j - 1, np.arange(n)], curve[j, np.arange(n)]
    t = np.clip((thr - lo) / np.where(np.abs(hi - lo) < EPS, 1.0, hi - lo), 0.0, 1.0)
    ell = fr[j - 1] + t * (fr[j] - fr[j - 1])
    ell = np.where(first == 0, 0.0, ell)                 # over before it moved
    return np.where(first >= len(fr), fr[-1], ell)


# ------------------------------------------------------- do the centres agree --

def agreement(a, seed=SEED):
    """How far a curved stroke's centre is from its nearest curved neighbour's.

    In units of its own radius, so a big lazy arc and a tight one are on the
    same scale, and against a null that keeps every centre and every midpoint
    and only permutes which stroke has which -- so the null has the same
    radius distribution, the same spatial layout and no agreement.
    """
    from scipy.spatial import cKDTree
    m = (a["turn"] >= TURN_MIN) & np.isfinite(a["r"])
    if m.sum() < 50:
        return None
    mid, cen, r = a["mid"][m], a["cen"][m], a["r"][m]
    rel = cen - mid
    tree = cKDTree(mid)
    _, j = tree.query(mid, k=2)
    j = j[:, 1]

    def stat(rl):
        c = mid + rl
        return float(np.median(np.hypot(*(c - c[j]).T) / np.maximum(r, EPS)))

    rs = np.random.default_rng(seed)
    obs = stat(rel)
    nul = float(np.median([stat(rel[rs.permutation(len(rel))]) for _ in range(SHUF)]))
    return dict(n=int(m.sum()), obs=obs, null=nul,
                ratio=float(nul / max(obs, EPS)),
                spacing=float(np.median(np.hypot(*(mid - mid[j]).T))))


# ---------------------------------------------------------------- the report --

def curl(doc, p, audit=False, verbose=True):
    t0 = time.time()
    src = os.path.join(ROOT, p["source"])
    img, _ = E.working_image(p, src, verbose=False)
    a, co, de0, cens = slide(doc, p, img)
    ag = agreement(a)

    turn = a["turn"]
    strong = turn >= TURN_MIN
    med = lambda x, m: float(np.median(x[m])) if m.any() else 0.0
    ratio = med(co["arc"], strong) / max(med(co["line"], strong), EPS)
    mratio = med(co["arc"], strong) / max(med(co["mirror"], strong), EPS)

    table = []
    for lo, hi in zip(BINS[:-1], BINS[1:]):
        m = (turn >= lo) & (turn < hi)
        if m.sum() < 30:
            continue
        table.append(dict(lo=lo, hi=hi, n=int(m.sum()),
                          arc=med(co["arc"], m), mirror=med(co["mirror"], m),
                          line=med(co["line"], m),
                          ratio=med(co["arc"], m) / max(med(co["line"], m), EPS)))

    # the amplitude the runtime is allowed, per stroke: half the measured
    # coherence length, because the motion swings both ways about where the
    # stroke actually is. In canvas short-edge units, like every other length
    # in the record.
    short = float(min(doc["canvas_px"]))
    amp = 0.5 * co["arc"] * a["arc"] / short
    # and nothing below the turn the ratios were measured over. A stroke that
    # barely bends has no curl to slide along -- every comparison in this file
    # excludes it because it cannot tell the arc from the tangent -- so it is
    # given no amplitude rather than a small one. It is also what keeps the
    # village at the bottom of the Starry Night still while the sky turns.
    amp = np.where(strong, amp, 0.0)
    rep = dict(
        motion="arc" if ratio >= RATIO_MIN else "line",
        moving=int((amp > 0).sum()),
        ratio=float(ratio), mirror_ratio=float(mratio),
        ratio_min=RATIO_MIN, turn_min=TURN_MIN,
        de_max=float(p["de_max"]), de_at_rest=float(np.median(de0)),
        stuck=float((co["arc"] <= 0).mean()), censored=float(cens["arc"]),
        turning=int(strong.sum()), straight=int(a["straight"].sum()),
        turn_median=float(np.median(turn)),
        arc_len=med(co["arc"], strong), line_len=med(co["line"], strong),
        mirror_len=med(co["mirror"], strong),
        amp_median=float(np.median(amp)), amp_max=float(amp.max()),
        bins=table, agree=ag,
    )

    if verbose:
        print(f"{doc['slug']}/{doc['tile']}: {len(turn)} strokes")
        print(f"  the arc             {a['straight'].sum()} straight,"
              f" {strong.sum()} turn past {TURN_MIN} rad"
              f"   median turn {np.median(turn):.2f} rad"
              f"   median radius {np.median(a['r'][np.isfinite(a['r'])])/p['px_per_cm']:.1f} cm")
        print(f"  colour at rest      dE {np.median(de0):.1f} against"
              f" the tracer's own tolerance of {p['de_max']:.0f}"
              f"   {(co['arc'] <= 0).mean()*100:.0f}% cannot move at all,"
              f" {cens['arc']*100:.0f}% never lose it inside {FMAX:.0f} lengths")
        print(f"  how far it slides   turn      n      arc  mirror    line"
              f"    arc/line   (in its own lengths)")
        for b in table:
            print(f"                      {b['lo']:.2f}-{b['hi']:.2f}"
                  f" {b['n']:6d}   {b['arc']:6.2f}  {b['mirror']:6.2f}"
                  f"  {b['line']:6.2f}      {b['ratio']:5.2f}x")
        print(f"  strokes that turn   arc {rep['arc_len']:.2f}"
              f"   mirror {rep['mirror_len']:.2f}   line {rep['line_len']:.2f}"
              f"    ==> {ratio:.2f}x the tangent, {mratio:.2f}x the mirror"
              f"   (pre-registered {RATIO_MIN}x)")
        if ag:
            print(f"  do centres agree?   {ag['n']} curved strokes,"
                  f" nearest neighbour {ag['spacing']/p['px_per_cm']*10:.1f} mm away:"
                  f"  {ag['obs']:.2f} radii apart against {ag['null']:.2f} shuffled"
                  f"  ({ag['ratio']:.2f}x)")
        print(f"  amplitude           {int((amp>0).sum())} of {len(amp)} strokes move;"
              f" median {np.median(amp[amp>0])*short/p['px_per_cm']*10 if (amp>0).any() else 0:.1f} mm,"
              f" largest {rep['amp_max']*short/p['px_per_cm']*10:.0f} mm"
              f"   ==> {rep['motion'].upper()}   {time.time()-t0:.0f}s")
    return rep, amp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("--audit", action="store_true", help="measure, write nothing")
    a = ap.parse_args()
    doc = json.load(open(a.json))
    p = json.load(open(os.path.join(ROOT, "params", doc["slug"] + ".json")))
    rep, amp = curl(doc, p, a.audit)
    if a.audit:
        print("  --audit: nothing written")
        return
    doc["curl"] = rep
    for s, v in zip(doc["strokes"], amp):
        s["curl"] = float(v)
    json.dump(doc, open(a.json, "w"))
    print(f"  wrote curl into {os.path.relpath(a.json, ROOT)}")


if __name__ == "__main__":
    main()
