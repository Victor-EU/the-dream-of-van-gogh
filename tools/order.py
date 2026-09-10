#!/usr/bin/env python3
"""Which stroke is on top. DESIGN.md 4.3's crossing solver, and its control.

At every crossing of two marks one of them is above the other, and the paint
says which. That is the design's best idea, and it is the one most likely to
return nothing, so this module is built the way M1 built the light: the
estimator and the test that could refute it are the same code, and the number
that decides is measured against a control rather than against a hope.

**The evidence.** Two cues, and they are independent in the way that matters --
one reads pigment, the other reads shape:

  colour      Step off the crossing along A far enough to clear B, sample A's
              own colour on both sides, do the same along B, and ask which of
              the two the pixel *at* the crossing actually is. A stroke's colour
              varies along its length, so the prediction for "A on top" is the
              mean of A's two neighbours -- which is the linear interpolation,
              and therefore exactly right for a stroke whose colour drifts.
  profile     Sample the cross-section across A at the crossing, and across A
              at the same two places either side. Regress one on the other.
              If A is on top its ridge and both its feet survive the crossing
              and the coefficient is near 1; if A is buried, the section across
              it is the *other* stroke's flat top and the coefficient is near 0.
              Detrended first, for M1's reason: a stroke lying across a tonal
              gradient shows a profile that is entirely composition.

The second cue is where the design's separate "ridge profile continuous" and
"edge crossing unbroken" tests both live. They are not two measurements. A
profile that keeps its crest and keeps its two feet is a ridge that is
continuous and edges that are unbroken, and regressing the whole section on
itself reads all of it at once.

**Three things that will fake a result if you let them.**

*Shallow crossings.* Two neighbouring marks running side by side "cross" at a
few degrees wherever the tracer wobbled, and there the profile across A is
mostly B by construction. Below 25 degrees the pair is refused.

*Colour that is not evidence.* Two strokes of the same colour cross thousands of
times on this canvas and none of those crossings carries any information at all.
If the two paints are not separated by more than the noise, the colour cue is
not weak, it is absent, and it votes zero rather than voting quietly.

*A pixel that is neither.* If the crossing matches neither stroke's colour, the
two-stroke model is wrong there -- a third mark, a glaze, a mis-fitted centre --
and the crossing is thrown away rather than resolved. The fraction thrown away
is reported, because it is the honest measure of how often the model holds.

**The test.** BUILD.md M2 fixes it in advance and it is not "does the solver
beat chance". Chance is 50% and the heuristics beat that easily on their own, so
a solver that merely rediscovered "thin and dark before thick and light" would
score well and would have found nothing in the paint. So the crossings are held
out **by region**, never at random -- a topological order is globally coupled and
a randomly withheld crossing is half-implied by the ring of crossings around it
-- the order is rebuilt without them, and the same held-out crossings are then
put to the heuristic alone. Two numbers, always together, and the margin between
them is the claim.

    tools/order.py strokes/m2/reaper-canvas.json            # solve and write
    tools/order.py strokes/m2/reaper-canvas.json --audit    # measure, write nothing
"""
import argparse, json, math, os, sys, time
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

EPS = 1e-12

NSAMP = 17                  # polyline samples along a stroke, uniform in t
MIN_SIN = 0.42              # 25 degrees. below this a crossing is two neighbours
CORE = 0.5                  # the two centrelines come this close, in the narrower width
PV = np.linspace(-1.15, 1.15, 15, dtype=np.float32)     # profile, in half-widths
DE_FLOOR = 1.2              # dE that the scan itself carries, after smoothing
QUAL = 4.0                  # the visible paint must be somebody's, within this
MARG = 1.0                  # and beat the runner-up by this much noise
MARG_CLIP = 6.0
OFFS = (-1.75, -1.0, 1.0, 1.75)     # where along the stroke a clean sample is

LAM = 0.2                   # how hard the habits pull where nothing crosses
SEP = 0.35                  # and how hard one crossing pushes against them
WPROF = 0.0                 # the profile cue failed its own control (see solve)
KEEP = 30.0                 # percentile of edge weight below which an edge is dropped
BLOCK = 4.0                 # hold-out block, in stroke lengths
LATTICE = 0.5               # sample the canvas this often, in stroke widths
FOLDS = 5                   # spatial folds, contiguous, by median cut
ACTS = 8                    # spans cut; DESIGN 5.2's six names, adjacent ones merged


# ------------------------------------------------------------- the canvas --

def lab_surface(work, sigma, band=2048):
    """Smoothed CIE Lab of the whole canvas, float32, banded.

    Smoothed at the same scale M1 profiles at: above the 9 px weave and the
    6 px brush striation, well below a stroke's flank. Every colour this module
    compares is read from here, so the weave cannot be mistaken for a crossing
    and two samples of the same paint differ by the scan's noise rather than by
    the cloth's.
    """
    H, W = work.shape[:2]
    pad = int(3 * sigma) + 2
    out = np.empty((H, W, 3), np.float32)
    for y in range(0, H, band):
        y1 = min(H, y + band)
        a, b = max(0, y - pad), min(H, y1 + pad)
        rgb = np.asarray(work[a:b], np.float32) / 255.0
        lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
        m = np.array([[0.4124564, 0.3575761, 0.1804375],
                      [0.2126729, 0.7151522, 0.0721750],
                      [0.0193339, 0.1191920, 0.9503041]], np.float32)
        xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883], np.float32)
        f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
        lab = np.stack([116 * f[..., 1] - 16,
                        500 * (f[..., 0] - f[..., 1]),
                        200 * (f[..., 1] - f[..., 2])], -1)
        out[y:y1] = gaussian_filter(lab, (sigma, sigma, 0))[y - a:y1 - a]
        del rgb, lin, xyz, f, lab
    return out


def _pick(F, x, y, block=1 << 22):
    """Bilinear sample of one plane at scattered points, in blocks."""
    x, y = np.asarray(x, np.float32).ravel(), np.asarray(y, np.float32).ravel()
    out = np.empty(len(x), np.float32)
    for i in range(0, len(x), block):
        j = min(len(x), i + block)
        out[i:j] = map_coordinates(F, [y[i:j], x[i:j]], order=1, mode="nearest")
    return out


def sample_lab(lab, pts):
    """(m,3) Lab at (m,2) points."""
    return np.stack([_pick(lab[..., c], pts[..., 0], pts[..., 1])
                     for c in range(3)], -1)


# ---------------------------------------------------------------- geometry --

def bez(P, t):
    """Point and unit tangent of a quadratic. P (m,3,2), t (m,) -> (m,2),(m,2)."""
    t = np.asarray(t, np.float32)[:, None]
    q = (1 - t) ** 2 * P[:, 0] + 2 * t * (1 - t) * P[:, 1] + t ** 2 * P[:, 2]
    d = 2 * (1 - t) * (P[:, 1] - P[:, 0]) + 2 * t * (P[:, 2] - P[:, 1])
    return q, d / np.maximum(np.hypot(d[:, 0], d[:, 1]), EPS)[:, None]


def polyline(P, n=NSAMP):
    """(m,n,2) samples uniform in t, and (m,n) cumulative arc length."""
    t = np.linspace(0.0, 1.0, n, dtype=np.float32)
    q = ((1 - t) ** 2)[None, :, None] * P[:, 0][:, None, :] \
        + (2 * t * (1 - t))[None, :, None] * P[:, 1][:, None, :] \
        + (t ** 2)[None, :, None] * P[:, 2][:, None, :]
    d = np.hypot(*np.diff(q, axis=1).transpose(2, 0, 1))
    return q.astype(np.float32), np.concatenate(
        [np.zeros((len(P), 1), np.float32), np.cumsum(d, 1)], 1).astype(np.float32)


def t_at_arc(A, s):
    """t of arc length s along rows of the cumulative table A (m,K)."""
    K = A.shape[1]
    j = np.clip((A < s[:, None]).sum(1), 1, K - 1)
    r = np.arange(len(s))
    a0, a1 = A[r, j - 1], A[r, j]
    return ((j - 1) + (s - a0) / np.maximum(a1 - a0, EPS)) / (K - 1)


# --------------------------------------------------------------- crossings --

def _cell_pairs(x0, y0, x1, y1, cell):
    """Index pairs whose bounding boxes share a grid cell. i < j, unique."""
    n = len(x0)
    gx0, gy0 = np.floor(x0 / cell).astype(np.int64), np.floor(y0 / cell).astype(np.int64)
    gx1, gy1 = np.floor(x1 / cell).astype(np.int64), np.floor(y1 / cell).astype(np.int64)
    nx = int(gx1.max()) + 2
    ids, keys = [], []
    for i in range(n):
        xs = np.arange(gx0[i], gx1[i] + 1)
        ys = np.arange(gy0[i], gy1[i] + 1)
        k = (ys[:, None] * nx + xs[None, :]).ravel()
        keys.append(k)
        ids.append(np.full(len(k), i, np.int64))
    keys, ids = np.concatenate(keys), np.concatenate(ids)
    o = np.argsort(keys, kind="stable")
    keys, ids = keys[o], ids[o]
    b = np.flatnonzero(np.diff(keys)) + 1
    out = []
    for lo, hi in zip(np.concatenate([[0], b]), np.concatenate([b, [len(keys)]])):
        g = ids[lo:hi]
        if len(g) < 2:
            continue
        a, c = np.triu_indices(len(g), 1)
        out.append(np.stack([g[a], g[c]], 1))
    if not out:
        return np.zeros((0, 2), np.int64)
    q = np.concatenate(out)
    q.sort(axis=1)
    return np.unique(q, axis=0)


def crossings(P, wid, mark, chunk=20000):
    """Every pair of marks that share paint, with where and at what angle.

    Not "where the centrelines intersect", which is what the design's wording
    suggests and what this first did. Extraction returns short fat arcs -- on the
    Reaper a stroke is 3.3 times as long as it is wide -- and two short fat arcs
    overlap constantly while their centrelines miss each other: 143,000 pairs of
    strokes on that canvas share a bounding box and only 47,000 of them cross in
    the strict sense. Throwing the other two thirds away starves the graph below
    the density at which an order can propagate at all.

    So the event is the closest approach of the two centrelines, kept when the
    two *cores* overlap -- within half of the narrower stroke's width, which is
    where its own paint certainly is. Intersection is the special case where
    that distance is zero, so nothing is lost and a great deal is gained.

    A pair that touches in two places keeps its squarest touch rather than both.
    Two pieces of the same traced mark are not a crossing, they are a corner.
    """
    pts, arc = polyline(P)
    x0, x1 = pts[..., 0].min(1), pts[..., 0].max(1)
    y0, y1 = pts[..., 1].min(1), pts[..., 1].max(1)
    w = 0.5 * wid
    cell = max(float(np.median(np.hypot(x1 - x0, y1 - y0))) * 2.0, 64.0)
    cand = _cell_pairs(x0 - w, y0 - w, x1 + w, y1 + w, cell)
    if not len(cand):
        return None
    ia, ib = cand[:, 0], cand[:, 1]
    keep = ((x0[ia] <= x1[ib]) & (x0[ib] <= x1[ia]) &
            (y0[ia] <= y1[ib]) & (y0[ib] <= y1[ia]) & (mark[ia] != mark[ib]))
    ia, ib = ia[keep], ib[keep]

    K = NSAMP
    tg = np.stack([bez(P, np.full(len(P), t, np.float32))[1]
                   for t in np.linspace(0, 1, K, dtype=np.float32)], 1)
    core = CORE * np.minimum(wid[ia], wid[ib])
    oa, ob, ota, otb, osn = [], [], [], [], []
    for i in range(0, len(ia), chunk):
        j = min(len(ia), i + chunk)
        A, B = pts[ia[i:j]], pts[ib[i:j]]
        d = np.hypot(A[:, :, None, 0] - B[:, None, :, 0],
                     A[:, :, None, 1] - B[:, None, :, 1])
        ta_, tb_ = tg[ia[i:j]], tg[ib[i:j]]
        sn = np.abs(ta_[:, :, None, 0] * tb_[:, None, :, 1]
                    - ta_[:, :, None, 1] * tb_[:, None, :, 0])
        ok = (d <= core[i:j, None, None]) & (sn >= MIN_SIN)
        score = np.where(ok, sn, -1.0).reshape(j - i, -1)
        best = score.argmax(1)
        got = score[np.arange(j - i), best] > 0
        if not got.any():
            continue
        r = np.arange(j - i)[got]
        sa, sb = best[got] // K, best[got] % K
        oa.append(ia[i:j][got])
        ob.append(ib[i:j][got])
        ota.append(sa / (K - 1.0))
        otb.append(sb / (K - 1.0))
        osn.append(sn.reshape(j - i, -1)[r, best[got]])
    if not oa:
        return None
    return dict(ia=np.concatenate(oa), ib=np.concatenate(ob),
                ta=np.concatenate(ota).astype(np.float32),
                tb=np.concatenate(otb).astype(np.float32),
                sn=np.concatenate(osn).astype(np.float32), arc=arc)


# ---------------------------------------------------------------- evidence --

def stroke_lab(lab, P, wid, k=24, band=0.30):
    """Each stroke's own colour: the median down a narrow band of its centreline.

    Needed because the local samples either side of a crossing are frequently
    not the stroke at all -- at 92% coverage a mark is crossed again a
    centimetre later, and a sample taken there is somebody else's paint. The
    median over the whole length survives that; what it cannot see is a stroke
    whose colour drifts, which is what the local samples are for. Both are
    measured and `evidence` decides between them per crossing.
    """
    t = np.linspace(0.08, 0.92, k, dtype=np.float32)
    v = np.linspace(-band, band, 3, dtype=np.float32)
    out = np.empty((len(P), 3), np.float32)
    for i in range(0, len(P), 4096):
        j = min(len(P), i + 4096)
        m = j - i
        tt = np.repeat(t, m)
        q, tg = bez(np.tile(P[i:j], (k, 1, 1)), tt)
        nrm = np.stack([-tg[:, 1], tg[:, 0]], 1)
        hw = np.tile(0.5 * wid[i:j], k)[:, None]
        px = q[:, 0:1] + nrm[:, 0:1] * hw * v[None, :]
        py = q[:, 1:2] + nrm[:, 1:2] * hw * v[None, :]
        for c in range(3):
            g = _pick(lab[..., c], px, py).reshape(k * m, 3).mean(1)
            out[i:j, c] = np.median(g.reshape(k, m), 0)
    return out


def _trimmed(S, V):
    """Mean of the clean samples with the worst one dropped, and their spread.

    A stroke's neighbours either side of a crossing are supposed to be that
    stroke, and on a canvas at 92% coverage they are frequently something else
    that crossed it a centimetre away. Two samples cannot tell which of them is
    the intruder, so there are four, and the one furthest from the others is
    dropped before the mean is taken. What is left of the spread is the noise
    estimate the vetoes are measured in -- so a stroke whose neighbourhood is
    genuinely inconsistent still refuses to vote, which is the point.
    """
    w = V.astype(np.float32)
    cnt = w.sum(1)
    mu0 = (w[..., None] * S).sum(1) / np.maximum(cnt, 1)[:, None]
    d = np.where(V, np.sqrt(((S - mu0[:, None, :]) ** 2).sum(-1)), -1.0)
    w2 = w.copy()
    r = np.arange(len(S))
    trim = cnt >= 3
    w2[r[trim], d.argmax(1)[trim]] = 0.0
    c2 = np.maximum(w2.sum(1), 1)
    mu = (w2[..., None] * S).sum(1) / c2[:, None]
    sp = (w2 * np.sqrt(((S - mu[:, None, :]) ** 2).sum(-1))).sum(1) / c2
    return mu, (2.0 * sp).astype(np.float32)


def covering(X, P, wid, chunk=400000):
    """Every stroke whose footprint contains each point, as a CSR pair of arrays.

    This is the one thing the extraction knows that a pairwise reading of the
    scan does not: every mark on the canvas, not just the two being compared.
    """
    n = len(P)
    pts, _ = polyline(P)
    hw = 0.5 * wid
    cell = max(float(np.median(wid)), 16.0)
    g = lambda a: np.floor(a / cell).astype(np.int64)
    gx0, gx1 = g(pts[..., 0].min(1) - hw), g(pts[..., 0].max(1) + hw)
    gy0, gy1 = g(pts[..., 1].min(1) - hw), g(pts[..., 1].max(1) + hw)
    nx = int(gx1.max()) + 2
    keys, ids = [], []
    for i in range(n):
        xs = np.arange(gx0[i], gx1[i] + 1)
        ys = np.arange(gy0[i], gy1[i] + 1)
        k = (ys[:, None] * nx + xs[None, :]).ravel()
        keys.append(k)
        ids.append(np.full(len(k), i, np.int64))
    keys, ids = np.concatenate(keys), np.concatenate(ids)
    o = np.argsort(keys, kind="stable")
    keys, ids = keys[o], ids[o]
    uk, start = np.unique(keys, return_index=True)
    cnt = np.diff(np.append(start, len(keys)))

    qk = g(X[:, 1]) * nx + g(X[:, 0])
    j = np.clip(np.searchsorted(uk, qk), 0, len(uk) - 1)
    c = np.where(uk[j] == qk, cnt[j], 0)
    if not c.any():
        return np.zeros(0, np.int64), np.zeros(0, np.int64)
    rep = np.repeat(np.arange(len(X)), c)
    off = np.concatenate([np.arange(v) for v in c[c > 0]])
    cand = ids[np.repeat(start[j], c) + off]
    keep = np.zeros(len(rep), bool)
    for i in range(0, len(rep), chunk):
        k = slice(i, min(len(rep), i + chunk))
        r, cd = rep[k], cand[k]
        q = pts[cd]
        a, b = q[:, :-1], q[:, 1:]
        e = b - a
        t = np.clip(((X[r][:, None, 0] - a[..., 0]) * e[..., 0]
                     + (X[r][:, None, 1] - a[..., 1]) * e[..., 1])
                    / np.maximum((e ** 2).sum(-1), EPS), 0, 1)
        dx = a[..., 0] + t * e[..., 0] - X[r][:, None, 0]
        dy = a[..., 1] + t * e[..., 1] - X[r][:, None, 1]
        keep[k] = np.sqrt(dx ** 2 + dy ** 2).min(1) <= hw[cd]
    return rep[keep], cand[keep]


def stacking(X, cx, slab, sig, P, wid):
    """Who is visible where several marks overlap, and therefore who is on top.

    The design reads a crossing as a two-horse race: is the pixel A's colour or
    B's? On a canvas painted three and a half times over that question is
    usually the wrong one. Three quarters of the crossings the geometry finds on
    the Reaper are better explained by some *third* mark than by either of the
    two -- measured, and against a control: shuffle which stroke owns which
    colour and the third mark wins only a quarter of the time and is worse by
    four dE rather than better by one.

    So the third mark is not noise to be vetoed, it is the answer. Every stroke
    whose footprint contains the point is a candidate, the one whose colour the
    paint actually is was laid after all the others there, and one point yields
    as many facts as there are marks stacked on it rather than one. That is what
    lifts the graph over the density at which an order can propagate at all.

    Returns loser -> winner edges and the margin, in noise units, that the
    winner won by. A point whose winner did not win clearly returns nothing:
    two candidates of the same colour cannot be told apart and must not be
    guessed at.
    """
    rep, cand = covering(X, P, wid)
    if not len(rep):
        return (np.zeros(0, np.int64),) * 2 + (np.zeros(0, np.float32),)
    d = np.sqrt(((cx[rep] - slab[cand]) ** 2).sum(-1))
    o = np.lexsort((d, rep))
    rep, cand, d = rep[o], cand[o], d[o]
    first = np.flatnonzero(np.r_[True, rep[1:] != rep[:-1]])
    k = np.diff(np.r_[first, len(rep)])
    two = k >= 2
    win = cand[first]
    d1 = d[first]
    d2 = np.where(two, d[np.minimum(first + 1, len(d) - 1)], np.inf)
    sg = sig[rep[first]]
    marg = (d2 - d1) / np.maximum(sg, EPS)
    good = two & (d1 <= QUAL * sg) & (marg >= MARG)
    ok = np.repeat(good, k)
    isw = np.zeros(len(rep), bool)
    isw[first] = True
    sel = ok & ~isw
    return (cand[sel], np.repeat(win, k)[sel],
            np.clip(np.repeat(marg, k)[sel], 0, MARG_CLIP).astype(np.float32))


def lattice_facts(lab, P, wid, mark, slab, sig, step):
    """The same reading, taken on a lattice over the whole canvas.

    A stacking fact does not need a crossing. It needs a point where more than
    one mark is present, and the design's insistence on crossings is a
    restriction inherited from the pairwise question rather than from the
    physics: wherever two marks overlap at all, the visible colour names the one
    that was laid last. Reading only at the squarest touch of each pair throws
    away almost all of the evidence -- on the Reaper, 18,000 facts against a
    quarter of a million -- and it throws away the easy ones, since a pair that
    overlaps over a centimetre gets read once instead of thirty times.

    So the canvas is sampled on a lattice at half a stroke width and every point
    covered by two marks or more is asked the same question `stacking` asks. The
    crossing geometry is still what the *profile* cue needs, and it is still
    computed; this is what the colour cue turned out to want instead.
    """
    H, W = lab.shape[:2]
    xs = np.arange(step * 0.5, W, step, dtype=np.float32)
    ys = np.arange(step * 0.5, H, step, dtype=np.float32)
    X = np.stack(np.meshgrid(xs, ys, indexing="xy"), -1).reshape(-1, 2)
    cx = sample_lab(lab, X)
    sg = np.full(len(X), sig, np.float32)
    u, v, w = stacking(X, cx, slab, sg, P, wid)
    keep = mark[u] != mark[v]
    return u[keep], v[keep], w[keep]


# Measured and not kept. On the synthetic canvas the lattice is a small gain --
# eighty percent of the visible order recovered against seventy-eight, and two
# hundred more points of margin than it costs. On all three museum canvases it
# is a loss, and the two diagnostics that do not go through the exit test agree
# about why: the stacking graph's consistency ratio falls from 30x, 44x and 24x
# to 16x, 20x and 10x, and repeated readings of the same pair stop agreeing
# quite as often, 96% down to 92%. A lattice point has no crossing geometry near
# it, so the noise it is judged against is the canvas median rather than the
# neighbourhood's own, and a gate scaled by the wrong noise lets the wrong facts
# through. Reachable by --lattice, off by default, and the reason is here rather
# than in a commit message.


def _patch(lab, X, TA, TB, wmin):
    """The colour at the crossing, medianed over the patch the two marks share.

    One pixel at the fitted intersection is one pixel, and the intersection is
    fitted. Five points inside the overlap, medianed, survive a centre that is
    a few pixels out -- which at a 69 px median stroke width it certainly is.
    """
    o = 0.22 * wmin[:, None]
    P = np.stack([X, X + o * TA, X - o * TA, X + o * TB, X - o * TB], 1)
    S = np.stack([np.stack([_pick(lab[..., c], P[:, k, 0], P[:, k, 1])
                            for c in range(3)], -1) for k in range(5)], 1)
    return np.median(S, 1)


def _detrend(q):
    """Remove the mean and the ramp: what is left is the stroke, not the ground."""
    v = PV - PV.mean()
    q = q - q.mean(1, keepdims=True)
    return q - ((q * v).sum(1) / (v * v).sum())[:, None] * v[None, :]


def _profile(F, X, N, hw, block=1 << 21):
    """Cross-section at m places: (m, len(PV)) samples of one plane."""
    u = PV[None, :] * hw[:, None]
    sx = X[:, 0:1] + N[:, 0:1] * u
    sy = X[:, 1:2] + N[:, 1:2] * u
    return _pick(F, sx, sy, block).reshape(len(X), len(PV))


def evidence(lab, P, wid, cr, sigma=4.0, slab=None, mark=None,
             lattice=False):
    """The two cues, per crossing, and the noise scale they are measured in.

    How far to step off the crossing is not a taste parameter. It is however far
    it takes to get out from under the other stroke -- its half-width, divided
    by the sine of the crossing angle, plus the blur the sampling itself put
    there. Step less and the "clean" sample is the other stroke; step more and
    the sample has left the part of A that is near the crossing at all. Those
    samples are what sets the local noise: if a stroke's own neighbourhood
    disagrees with itself, nothing measured there is worth a vote, and both
    cues are scaled by that disagreement rather than by a constant.
    """
    ia, ib, ta, tb = cr["ia"], cr["ib"], cr["ta"], cr["tb"]
    arc, sn = cr["arc"], cr["sn"]
    XA, TA = bez(P[ia], ta)
    XB, TB = bez(P[ib], tb)
    X = 0.5 * (XA + XB)

    sA, sB = arc[ia], arc[ib]
    LA, LB = sA[:, -1], sB[:, -1]
    cA, cB = _arc_at(sA, ta), _arc_at(sB, tb)
    clear = lambda wo: (0.5 * wo + np.maximum(0.20 * wo, 3.0 * sigma)) / sn
    dA, dB = clear(wid[ib]), clear(wid[ia])

    def side(idx, s_, c_, d_, tip_, L_, k):
        a = c_ + k * d_
        t = t_at_arc(s_, np.clip(a, 0, L_))
        pt, tg = bez(P[idx], t)
        return pt, tg, (a >= tip_) & (a <= L_ - tip_)

    SA = [side(ia, sA, cA, dA, 0.25 * wid[ia], LA, k) for k in OFFS]
    SB = [side(ib, sB, cB, dB, 0.25 * wid[ib], LB, k) for k in OFFS]
    mA, pA, mB, pB = SA[1][2], SA[2][2], SB[1][2], SB[2][2]
    live = np.any([q[2] for q in SA], 0) & np.any([q[2] for q in SB], 0)

    def blend(qm, qp, m, q):
        wm, wp = m.astype(np.float32), q.astype(np.float32)
        d = np.maximum(wm + wp, 1.0)
        return (wm[..., None] * qm + wp[..., None] * qp) / d[..., None]

    cx = _patch(lab, X, TA, TB, np.minimum(wid[ia], wid[ib]))
    _, nA = _trimmed(np.stack([sample_lab(lab, q[0]) for q in SA], 1),
                     np.stack([q[2] for q in SA], 1))
    _, nB = _trimmed(np.stack([sample_lab(lab, q[0]) for q in SB], 1),
                     np.stack([q[2] for q in SB], 1))
    sig = np.maximum(0.5 * (nA + nB), DE_FLOOR)

    # ---- who is visible here, among everything that covers it
    st = None
    if slab is not None:
        st = stacking(X, cx, slab, sig, P, wid)
        if lattice:                     # and everywhere else that marks overlap
            lt = lattice_facts(lab, P, wid, mark, slab, float(np.median(sig)),
                               LATTICE * float(np.median(wid)))
            st = tuple(np.concatenate([a, b]) for a, b in zip(st, lt))

    # ---- profile continuity, on L* alone, and strictly between these two
    L = lab[..., 0]
    perp = lambda t: np.stack([-t[:, 1], t[:, 0]], 1)
    hwA, hwB = 0.5 * wid[ia], 0.5 * wid[ib]
    pAx = _detrend(_profile(L, X, perp(TA), hwA))
    pAr = _detrend(blend(_profile(L, SA[1][0], perp(SA[1][1]), hwA),
                         _profile(L, SA[2][0], perp(SA[2][1]), hwA), mA, pA))
    pBx = _detrend(_profile(L, X, perp(TB), hwB))
    pBr = _detrend(blend(_profile(L, SB[1][0], perp(SB[1][1]), hwB),
                         _profile(L, SB[2][0], perp(SB[2][1]), hwB), mB, pB))
    eA, eB = (pAr ** 2).sum(1), (pBr ** 2).sum(1)
    rhoA = (pAx * pAr).sum(1) / np.maximum(eA, EPS)
    rhoB = (pBx * pBr).sum(1) / np.maximum(eB, EPS)
    amp = np.minimum(np.sqrt(eA / len(PV)), np.sqrt(eB / len(PV)))
    flat = amp < DE_FLOOR                             # no section to be continuous
    gp = np.where(flat | ~live, 0.0, np.clip(rhoA - rhoB, -3.0, 3.0))

    return dict(gp=gp.astype(np.float32), X=X.astype(np.float32), live=live,
                st=st, flat=flat, sig=sig.astype(np.float32),
                amp=amp.astype(np.float32), cx=cx)


def _arc_at(A, t):
    """Arc length at parameter t, from the uniform-in-t table A (m,K)."""
    K = A.shape[1]
    f = np.clip(t, 0, 1) * (K - 1)
    j = np.clip(f.astype(np.int64), 0, K - 2)
    r = np.arange(len(t))
    return A[r, j] + (f - j) * (A[r, j + 1] - A[r, j])


# ------------------------------------------------------------- the digraph --

def mad(a):
    a = a[a != 0]
    return float(1.4826 * np.median(np.abs(a))) if len(a) else 1.0


def cue_agreement(a, b, n):
    """Where two cues both have an opinion about the same pair, how often the
    same opinion. Chance is 50, and if their errors were independent and they
    were equally good it would pin how good -- an assumption large enough that
    the number is printed as a cross-check and never as the result."""
    ka = np.minimum(a[0], a[1]).astype(np.int64) * n + np.maximum(a[0], a[1])
    kb = np.minimum(b[0], b[1]).astype(np.int64) * n + np.maximum(b[0], b[1])
    sa, sb = a[0] < a[1], b[0] < b[1]
    oa, ob = np.argsort(ka), np.argsort(kb)
    ka, sa, kb, sb = ka[oa], sa[oa], kb[ob], sb[ob]
    j = np.searchsorted(kb, ka)
    j = np.clip(j, 0, max(len(kb) - 1, 0))
    hit = (len(kb) > 0) & (kb[j] == ka)
    if not np.any(hit):
        return float("nan"), 0
    return float((sa[hit] == sb[j][hit]).mean()), int(hit.sum())


def merge(u, v, sw, n):
    """One pair seen many times is one edge, and how often it changed its mind.

    A pair of marks overlapping over a centimetre is sampled at several points
    and each point votes on its own. Summing the signed votes and keeping the
    net is a weighted majority; the ratio of the net to the total is how much
    those votes agreed, which is a consistency measure that costs nothing and
    is reported rather than thrown away.
    """
    lo, hi = np.minimum(u, v), np.maximum(u, v)
    sgn = np.where(u < v, 1.0, -1.0)
    key = lo.astype(np.int64) * n + hi
    uk, inv = np.unique(key, return_inverse=True)
    net = np.bincount(inv, sgn * sw, len(uk))
    tot = np.bincount(inv, np.abs(sw), len(uk))
    a, b = uk // n, uk % n
    live = net != 0.0                 # a pair whose votes cancelled says nothing
    a, b, net, tot = a[live], b[live], net[live], tot[live]
    fwd = net > 0
    return (np.where(fwd, a, b), np.where(fwd, b, a),
            np.abs(net).astype(np.float32), tot.astype(np.float32))


def build_edges(ev, cr, n, wcol=1.0, wprof=WPROF):
    """Merge the cues into one signed graph. (u, v) asserts u was laid before v.

    The two are put on one scale by their own spread rather than by a chosen
    weight, so neither cue can dominate because its units happen to be larger.
    """
    su, sv, sw = ev["st"] if ev["st"] is not None else (
        np.zeros(0, np.int64), np.zeros(0, np.int64), np.zeros(0, np.float32))
    gp = ev["gp"]
    m = gp != 0
    pu = np.where(gp[m] > 0, cr["ib"][m], cr["ia"][m])
    pv = np.where(gp[m] > 0, cr["ia"][m], cr["ib"][m])
    pw = np.abs(gp[m]) / max(mad(gp), EPS)
    sw = sw / max(mad(sw), EPS)
    u = np.concatenate([su, pu])
    v = np.concatenate([sv, pv])
    w = np.concatenate([wcol * sw, wprof * pw]).astype(np.float32)
    return merge(u, v, w, n) + (
        merge(su, sv, sw, n), merge(pu, pv, pw, n))


def gr_arrangement(n, u, v, w):
    """Eades-Lin-Smyth greedy, weighted: an ordering whose back-edges are few.

    Sinks to the tail, sources to the head, and otherwise the vertex with the
    most weight pointing out of it relative to in. Linear in the graph, which
    matters at twenty thousand strokes, and it is here for one number: the
    weight that has to be cut to make the confident subgraph acyclic. That
    number only means something next to the same number for the same graph with
    its arrows thrown at random, which `audit` computes alongside it.
    """
    import heapq
    outw, inw = np.zeros(n), np.zeros(n)
    np.add.at(outw, u, w)
    np.add.at(inw, v, w)
    adj_out, adj_in = [[] for _ in range(n)], [[] for _ in range(n)]
    for k in range(len(u)):
        adj_out[u[k]].append((v[k], w[k]))
        adj_in[v[k]].append((u[k], w[k]))
    alive = np.ones(n, bool)
    head, tail = [], []
    heap = [(-(outw[i] - inw[i]), i) for i in range(n)]
    heapq.heapify(heap)
    sinks = [i for i in range(n) if outw[i] <= 0]
    sources = [i for i in range(n) if inw[i] <= 0 and outw[i] > 0]
    left = n

    def drop(i, to_head):
        nonlocal left
        alive[i] = False
        left -= 1
        (head if to_head else tail).append(i)
        for j, ww in adj_out[i]:
            if alive[j]:
                inw[j] -= ww
                if inw[j] <= 1e-9:
                    sources.append(j)
        for j, ww in adj_in[i]:
            if alive[j]:
                outw[j] -= ww
                if outw[j] <= 1e-9:
                    sinks.append(j)
                else:
                    heapq.heappush(heap, (-(outw[j] - inw[j]), j))

    while left:
        while sinks:
            i = sinks.pop()
            if alive[i] and outw[i] <= 1e-9:
                drop(i, False)
        while sources:
            i = sources.pop()
            if alive[i] and inw[i] <= 1e-9 and outw[i] > 1e-9:
                drop(i, True)
        if not left:
            break
        while heap:
            d, i = heapq.heappop(heap)
            if alive[i] and abs(-d - (outw[i] - inw[i])) < 1e-9:
                drop(i, True)
                break
        else:
            for i in range(n):
                if alive[i]:
                    drop(i, True)
                    break
    seq = head + tail[::-1]
    pos = np.empty(n, np.int64)
    pos[np.array(seq, np.int64)] = np.arange(n)
    return pos


def feedback(pos, u, v, w):
    """Fraction of the confident weight that points backwards in an ordering."""
    tot = float(w.sum())
    return float(w[pos[u] > pos[v]].sum()) / max(tot, EPS)


def consistency(u, v, w, n, seed=18531890):
    """How much of a cue's own weight has to be cut to make it acyclic, and how
    much would have to be cut from the same graph with its arrows thrown.

    This is the one quality measure available on a real canvas that does not go
    through the exit test, so it is the one that can be used to decide whether a
    cue is carrying anything without deciding the milestone by the same number.
    A cue that is guessing produces a graph as cyclic as a random orientation of
    itself; a cue that is reading the paint produces one that is much less so,
    because a real stacking order exists and cannot contradict itself.
    """
    if not len(u):
        return float("nan"), float("nan")
    fb = feedback(gr_arrangement(n, u, v, w), u, v, w)
    rng = np.random.default_rng(seed)
    sh = rng.random(len(u)) < 0.5
    a, b = np.where(sh, v, u), np.where(sh, u, v)
    return fb, feedback(gr_arrangement(n, a, b, w), a, b, w)


def relax(prior, u, v, w, n, lam=LAM, sep=SEP, iters=300):
    """The order itself: satisfy the crossings, and keep the habits where the
    crossings say nothing.

    The design says minimum feedback arc set and then extension over the sparse
    remainder by the habits. Done in that order the second half is a coin toss,
    because most strokes are constrained by nothing and an arrangement has no
    opinion about them. So both halves are one objective and it is solved at
    once.

    The loss on an edge is squared rather than hinged, and on the synthetic
    canvas that is worth a point and a half of agreement with the true order and
    six points of held-out margin. A hinge stops pulling the moment an edge is
    satisfied, so the cheapest solution is the one that moves each stroke as
    little as possible: every constraint met locally and nothing travelling
    further than one edge. Squared is also a weighted Laplacian, so a Jacobi
    sweep is exact arithmetic rather than a step size, and cycles resolve by the
    heavier side winning, which is a feedback arc set solved softly.

    `sep` is not a distance anybody should read literally -- two strokes with one
    crossing between them and nothing else land a third of the sequence apart.
    It is the weight of the evidence against the habit, and it is large because
    a habit should lose an argument with the paint. Both it and `lam` were fixed
    on the synthetic canvas, where the answer is known, and then applied to the
    museum's canvases unchanged.
    """
    r = prior.astype(np.float64).copy()
    den = lam + np.bincount(u, w, n) + np.bincount(v, w, n)
    for _ in range(iters):
        num = lam * prior + np.bincount(u, w * (r[v] - sep), n) \
                          + np.bincount(v, w * (r[u] + sep), n)
        r = num / den
    return r


def ranks(a):
    o = np.argsort(np.argsort(a, kind="stable"), kind="stable")
    return (o / max(1, len(a) - 1)).astype(np.float32)


# ------------------------------------------------------------- the control --

def folds(X, block, k=FOLDS):
    """Blocks of the canvas, several stroke-lengths across, dealt round robin.

    Blocks and not a random 20%: a topological order is globally coupled, so a
    crossing withheld at random sits inside a ring of crossings that between
    them very nearly imply it, and the solver would be scored on a question it
    had already been told the answer to. The block has to be large against the
    distance over which the evidence is correlated, which is a stroke length,
    and that is what `block` is measured in.

    But it must not be the whole quarter of the canvas either, which is what
    this did first: withhold one contiguous fifth and the strokes inside it have
    no constraints left at all, so the solver is reduced to the prior there and
    the test can only ever return zero. That is a badly posed test rather than a
    strict one. Scattered blocks keep the leak out and leave the rest of the
    canvas able to speak. The margin's sensitivity to the block size is
    reported, because a number that moves with it is a number about the test.
    """
    g = np.floor(X / max(block, 1.0)).astype(np.int64)
    key = g[:, 1] * (int(g[:, 0].max()) + 2) + g[:, 0]
    uk, inv = np.unique(key, return_inverse=True)
    rng = np.random.default_rng(18531890)
    return rng.permutation(len(uk))[inv] % k


def satisfied(r, u, v):
    return float((r[u] < r[v]).mean()) if len(u) else float("nan")


def audit(prior, u, v, w, X, n, block, lam=LAM, sep=SEP, seed=18531890,
          quiet=False):
    """Spatial cross-validation, with the heuristic on the same held-out edges.

    Reported together, always, because separately either one is a story. The
    solver's number alone flatters itself with everything the habits already
    knew; the margin is what the paint added.
    """
    rng = np.random.default_rng(seed)
    fl = folds(X, block)
    rows = []
    for f in range(FOLDS):
        tr, te = fl != f, fl == f
        r = relax(prior, u[tr], v[tr], w[tr], n, lam=lam, sep=sep)
        sh = rng.random(int(tr.sum())) < 0.5        # the same graph, arrows tossed
        su, sv = np.where(sh, v[tr], u[tr]), np.where(sh, u[tr], v[tr])
        rs = relax(prior, su, sv, w[tr], n, lam=lam, sep=sep)
        near = np.abs(prior[u[te]] - prior[v[te]]) < 0.10
        rows.append(dict(
            n=int(te.sum()), solver=satisfied(r, u[te], v[te]),
            heur=satisfied(prior, u[te], v[te]),
            shuffled=satisfied(rs, u[te], v[te]),
            n_near=int(near.sum()),
            solver_near=satisfied(r, u[te][near], v[te][near]),
            heur_near=satisfied(prior, u[te][near], v[te][near])))
        if not quiet:
            q = rows[-1]
            print(f"    fold {f}  {q['n']:6d} held out   solver {q['solver']*100:5.1f}%"
                  f"   heuristic {q['heur']*100:5.1f}%"
                  f"   margin {(q['solver']-q['heur'])*100:+5.1f}"
                  f"   arrows tossed {q['shuffled']*100:5.1f}%", flush=True)
    agg = lambda k: float(np.average([r[k] for r in rows],
                                     weights=[r["n"] for r in rows]))
    aggn = lambda k: float(np.average([r[k] for r in rows],
                                      weights=[max(r["n_near"], 1) for r in rows]))
    return dict(edges=int(len(u)), block=float(block), folds=rows,
                solver=agg("solver"), heuristic=agg("heur"),
                shuffled=agg("shuffled"),
                margin=agg("solver") - agg("heur"),
                near_n=int(sum(r["n_near"] for r in rows)),
                solver_near=aggn("solver_near"), heuristic_near=aggn("heur_near"))


def heuristic(strokes):
    """The habits of DESIGN 4.3, recomputed here rather than read out of the file.

    `extract.py` writes the same sequence into the strokes' `o`, and reading it
    back would be the obvious thing and would be wrong: run this module twice on
    one document and the second run would take the first run's answer as the
    habits it was supposed to be measured against. The margin would then be
    zero, the correlation with the habits would be one, and both would look like
    findings. The habits are a function of the strokes, so they are computed
    from the strokes.
    """
    import extract as E
    w = np.array([r["w"] for r in strokes], np.float32)
    lin = E.srgb_to_linear(np.array([r["rgb"] for r in strokes], np.float32)[None] / 255.0)
    lv = E.lightness(lin)[0]
    return ranks(0.5 * ranks(w) + 0.5 * ranks(lv))


def legible(order, prior, y, flags, chan):
    """What the sequence turned out to say, next to what the habits already said.

    BUILD.md M2 asks for `?xray` to show the sequence "doing something legible --
    sky before land, highlights last". Highlights last is not a test, because
    the heuristic puts light paint last by construction and would pass it while
    knowing nothing. Sky before land is a test: nothing in "thin and dark before
    thick and light" mentions where on the canvas a stroke is, so if the solved
    order separates top from bottom, the separation came out of the paint.
    """
    top, bot = y < 0.34, y > 0.66
    hi, co = (flags & 2) > 0, (flags & 1) > 0
    f = lambda o, m: float(o[m].mean()) if m.any() else float("nan")
    out = {}
    for tag, o in (("solver", order), ("heuristic", prior)):
        out[tag] = dict(top=f(o, top), bottom=f(o, bot), highlight=f(o, hi),
                        contour=f(o, co), all=float(o.mean()))
    a, b = order - order.mean(), prior - prior.mean()
    out["rho"] = float((a * b).sum() / max(np.sqrt((a * a).sum() * (b * b).sum()), EPS))
    return out


# ------------------------------------------------------------------- acts --

def acts(order, feat, k=ACTS):
    """Cut the solved sequence into contiguous spans that are each about one
    kind of stroke, then name the spans by what is in them.

    The boundaries are not chosen, they fall out: the sequence is split where
    splitting most reduces the within-span scatter of (where on the canvas, how
    light, how wide, contour, highlight). What is chosen is the vocabulary --
    six names from DESIGN 5.2 -- and which name each span gets, which is a rule
    over its own contents and is written down as one rather than eyeballed.
    """
    o = np.argsort(order, kind="stable")
    f = feat[o]
    f = (f - f.mean(0)) / np.maximum(f.std(0), EPS)
    n = len(f)
    c1 = np.concatenate([np.zeros((1, f.shape[1])), np.cumsum(f, 0)])
    c2 = np.concatenate([np.zeros((1, f.shape[1])), np.cumsum(f ** 2, 0)])

    def cost(a, b):
        if b - a < 2:
            return 0.0
        s, q = c1[b] - c1[a], c2[b] - c2[a]
        return float((q - s ** 2 / (b - a)).sum())

    cuts = [0, n]
    for _ in range(k - 1):
        best = None
        for i in range(len(cuts) - 1):
            a, b = cuts[i], cuts[i + 1]
            if b - a < 40:
                continue
            step = max(1, (b - a) // 400)
            base = cost(a, b)
            for m in range(a + 20, b - 20, step):
                g = base - cost(a, m) - cost(m, b)
                if best is None or g > best[0]:
                    best = (g, m)
        if best is None:
            break
        cuts = sorted(cuts + [best[1]])
    return o, cuts


def name_acts(o, cuts, y, light, width, contour, highlight):
    """Six names from DESIGN 5.2, one rule each, first match wins.

    The boundaries came out of the order; only the vocabulary is chosen, and
    which name a span gets is a rule over the span's own contents written down
    here rather than eyeballed afterwards. Two adjacent spans that earn the same
    name are one act -- the segmentation split them because something else about
    them moved, and an act called "land" twice in a row is a worse description
    than an act called "land" once.
    """
    hib, cob = 2.5 * float(highlight.mean()), 2.5 * float(contour.mean())
    out = []
    for i in range(len(cuts) - 1):
        idx = o[cuts[i]:cuts[i + 1]]
        hi, co = float(highlight[idx].mean()), float(contour[idx].mean())
        my, ml = float(y[idx].mean()), float(light[idx].mean())
        if hi > max(hib, 0.12):
            nm = "light"
        elif co > max(cob, 0.20):
            nm = "contour"
        elif i == 0:
            nm = "ground"
        elif my < 0.40:
            nm = "sky"
        elif my > 0.60:
            nm = "land"
        else:
            nm = "subject"
        if out and out[-1]["name"] == nm:
            out[-1]["count"] += int(cuts[i + 1] - cuts[i])
            continue
        out.append(dict(name=nm, first=int(cuts[i]),
                        count=int(cuts[i + 1] - cuts[i]),
                        y=my, light=ml, width=float(width[idx].mean()),
                        contour=co, highlight=hi))
    seen = {}                   # a name that comes back later is a second act
    for a in out:
        seen[a["name"]] = seen.get(a["name"], 0) + 1
    run = {}
    for a in out:
        if seen[a["name"]] > 1:
            run[a["name"]] = run.get(a["name"], 0) + 1
            a["name"] += f" {run[a['name']]}"
    return out


# -------------------------------------------------------------- the control --

def synthetic(n=3900, size=3000, seed=18531890, width=(24.0, 56.0), rel=0.16,
              alpha=1.0, mottle=0.10, weave=0.010, noise=0.004, hues=8):
    """A canvas whose order is known, painted the way the cues assume.

    The held-out test can only ever say that evidence gathered here predicts
    evidence gathered there. It cannot say the evidence is *right*, because
    nothing in the museum records which stroke Van Gogh laid first. So the
    estimator is also run where the answer exists: strokes laid in a known
    random permutation, each an opaque ribbon with a rounded top, on a mottled
    ground with weave and scan noise. Every number the audit prints is then
    printed again beside the truth.

    Two things are deliberately unlike the real canvas. The palette is drawn
    from eight hues, so roughly one crossing in eight is one colour over itself
    and the mute veto is exercised. And the order is random, which makes the
    heuristic control score fifty -- on a real canvas it scores far more than
    that, which is exactly why BUILD.md M2 asks for the margin and not the
    solver's number alone.
    """
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    lo = gaussian_filter(rng.standard_normal((size, size)).astype(np.float32), 90)
    lo /= max(float(np.std(lo)), EPS)
    img = np.empty((size, size, 3), np.float32)
    for c in range(3):
        img[..., c] = 0.42 + mottle * gaussian_filter(
            rng.standard_normal((size, size)).astype(np.float32), 70) / 0.02

    pal = np.stack([0.30 + 0.55 * rng.random(hues), 0.30 + 0.55 * rng.random(hues),
                    0.30 + 0.55 * rng.random(hues)], 1).astype(np.float32)
    P = np.empty((n, 3, 2), np.float32)
    wid = np.empty(n, np.float32)
    col = np.empty((n, 3), np.float32)
    for i in range(n):
        c0 = rng.random(2) * size
        th = rng.random() * 2 * np.pi
        L = 120 + rng.random() * 260
        d = np.array([np.cos(th), np.sin(th)], np.float32) * L
        bend = (rng.random() - 0.5) * 0.45 * L
        nrm = np.array([-d[1], d[0]], np.float32) / max(float(np.hypot(*d)), EPS)
        P[i] = np.stack([c0, c0 + 0.5 * d + bend * nrm, c0 + d])
        wid[i] = width[0] + rng.random() * (width[1] - width[0])
        col[i] = pal[rng.integers(hues)]

    seq = rng.permutation(n)                      # the answer
    top = np.full((size, size), -1, np.int32)     # and who ended up visible
    pts, _ = polyline(P, 33)
    for k in seq:
        w2 = 0.5 * wid[k]
        q = pts[k]
        x0, x1 = int(max(0, q[:, 0].min() - w2 - 2)), int(min(size, q[:, 0].max() + w2 + 3))
        y0, y1 = int(max(0, q[:, 1].min() - w2 - 2)), int(min(size, q[:, 1].max() + w2 + 3))
        if x1 <= x0 or y1 <= y0:
            continue
        gx, gy = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
        a, b = q[:-1], q[1:]
        e = b - a
        ee = np.maximum((e ** 2).sum(1), EPS)
        t = np.clip(((gx[..., None] - a[:, 0]) * e[:, 0]
                     + (gy[..., None] - a[:, 1]) * e[:, 1]) / ee, 0, 1)
        px = a[:, 0] + t * e[:, 0] - gx[..., None]
        py = a[:, 1] + t * e[:, 1] - gy[..., None]
        d2 = px ** 2 + py ** 2
        j = d2.argmin(-1)
        gi, gj = np.ogrid[0:y1 - y0, 0:x1 - x0]
        dist = np.sqrt(d2[gi, gj, j])
        m = dist <= w2
        if not m.any():
            continue
        v = np.clip(dist[m] / w2, 0, 1)
        shade = 1.0 + rel * (np.sqrt(np.maximum(1 - v * v, 0)) - 0.55)
        tgt = col[k][None, :] * shade[:, None]
        sub = img[y0:y1, x0:x1]
        sub[m] = (1 - alpha) * sub[m] + alpha * tgt
        top[y0:y1, x0:x1][m] = k
    g = np.sin(xx * 0.70) * np.sin(yy * 0.70)
    img += weave * g[..., None]
    img += noise * rng.standard_normal(img.shape).astype(np.float32)
    rgb = np.clip(img, 0, 1)
    srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - 0.055)
    truth = np.empty(n, np.float64)
    truth[seq] = np.arange(n) / max(1, n - 1)
    return (np.clip(srgb * 255, 0, 255).astype(np.uint8), P, wid, col, truth, top)


def control(args):
    """Run the whole estimator where the answer is known, and print both."""
    print(f"synthetic canvas: {args.n} strokes, {args.size} px, "
          f"relief {args.rel:.2f} of width, alpha {args.alpha:.2f}", flush=True)
    work, P, wid, col, truth, top = synthetic(args.n, args.size, args.seed,
                                              rel=args.rel, alpha=args.alpha)
    n = len(P)
    cr = crossings(P, wid, np.arange(n))
    lab = lab_surface(work, 4.0)
    slab = stroke_lab(lab, P, wid)
    ev = evidence(lab, P, wid, cr, 4.0, slab, np.arange(n), args.lattice)
    del lab
    ia, ib, X = cr["ia"], cr["ib"], ev["X"]
    whose = top[np.clip(X[:, 1].astype(int), 0, args.size - 1),
                np.clip(X[:, 0].astype(int), 0, args.size - 1)]
    seen = (whose == ia) | (whose == ib)
    print(f"  overlaps           {len(ia)}   {ev['live'].mean()*100:.0f}% sampleable")
    print(f"  still visible      {seen.mean()*100:.0f}% of them are not themselves "
          f"painted over -- the pairwise question the design asks has no answer "
          f"at the other {100-seen.mean()*100:.0f}%")
    su, sv, sw = ev["st"]
    print(f"  stacking facts     {len(su)}   right "
          f"{float((truth[su] < truth[sv]).mean())*100:.1f}%   "
          f"(and it names the top mark correctly at "
          f"{float((truth[sv] > truth[su]).mean())*100:.1f}% of them)")
    m = ev["gp"] != 0
    on_top = truth[ia] > truth[ib]
    acc = float(((ev["gp"][m] > 0) == on_top[m]).mean()) if m.any() else float("nan")
    mv = m & seen
    av = float(((ev["gp"][mv] > 0) == on_top[mv]).mean()) if mv.any() else float("nan")
    print(f"  profile votes      {int(m.sum())}   right {acc*100:.1f}%"
          f"   ({av*100:.1f}% where the crossing is still visible)")
    u, v, w, tot, S, R = build_edges(ev, cr, n)
    ag, nag = cue_agreement(S, R, n)
    print(f"  the two cues       agree {ag*100:.1f}% on {nag} shared pairs"
          f"   (which would make each right {_p_from_agreement(ag)*100:.0f}%;"
          f" they really are {float((truth[S[0]]<truth[S[1]]).mean())*100:.0f}%"
          f" and {float((truth[R[0]]<truth[R[1]]).mean())*100:.0f}%)")
    thresh = float(np.percentile(w, 30))
    keep = w >= thresh
    u, v, w = u[keep], v[keep], w[keep]
    Xe = 0.5 * (P[:, 1][u] + P[:, 1][v])
    print(f"  confident edges    {len(u)}   right "
          f"{float((truth[u] < truth[v]).mean())*100:.1f}%")
    pos = gr_arrangement(n, u, v, w)
    print(f"  feedback arc set   {feedback(pos, u, v, w)*100:.1f}% of the weight")
    lv = 0.2126729 * col[:, 0] + 0.7151522 * col[:, 1] + 0.0721750 * col[:, 2]
    prior = ranks(0.5 * ranks(wid) + 0.5 * ranks(lv)).astype(np.float64)
    r = relax(prior, u, v, w, n, lam=args.lam)
    o = ranks(r)
    print(f"  solved order       agrees with the truth on "
          f"{(((o[ia] > o[ib]) == on_top).mean())*100:.1f}% of all {len(ia)} "
          f"overlaps, {(((o[ia[seen]] > o[ib[seen]]) == on_top[seen]).mean())*100:.1f}%"
          f" of the ones still visible")
    print(f"  heuristic alone    "
          f"{(((prior[ia] > prior[ib]) == on_top).mean())*100:.1f}%"
          f"   <- a random truth, so this is where 50 comes from")
    arclen = float(np.median(cr["arc"][:, -1]))
    a = audit(prior, u, v, w, Xe, n, BLOCK * arclen, args.lam, quiet=True)
    print(f"  held out by region solver {a['solver']*100:.1f}%   "
          f"heuristic {a['heuristic']*100:.1f}%   "
          f"margin {a['margin']*100:+.1f}   arrows tossed {a['shuffled']*100:.1f}%"
          f"   (blocks of {BLOCK:.0f} stroke lengths, as on the real canvases)")
    print("  the held-out number is the one the museum's canvases can also "
          "produce; the ones above it are the ones they never can.")


def solve(doc, work, p, wcol=1.0, wprof=WPROF, thresh=None, lam=LAM,
          do_audit=True, quiet=False, lattice=False):
    n = len(doc["strokes"])
    cw, ch = doc["canvas_px"]
    P = np.array([[[q[0] * cw, q[1] * ch] for q in r["p"]] for r in doc["strokes"]],
                 np.float32)
    wid = np.array([r["w"] * min(cw, ch) for r in doc["strokes"]], np.float32)
    mark = np.array([r.get("mark", i) for i, r in enumerate(doc["strokes"])], np.int64)
    prior = heuristic(doc["strokes"]).astype(np.float64)
    mid = P[:, 1]

    t = time.time()
    cr = crossings(P, wid, mark)
    if cr is None:
        raise SystemExit("nothing overlaps: no evidence to read")
    print(f"  overlaps           {len(cr['ia'])} pairs of marks share paint at "
          f"25 deg or more   {len(cr['ia'])/n:.2f} a stroke   {time.time()-t:.0f}s",
          flush=True)

    t = time.time()
    sg = float(p["sigma_relief"])
    lab = lab_surface(work, sg)
    slab = stroke_lab(lab, P, wid)
    ev = evidence(lab, P, wid, cr, sg, slab, mark, lattice)
    del lab
    st = ev["st"]
    print(f"  evidence           {time.time()-t:.0f}s   "
          f"{ev['live'].mean()*100:.0f}% sampleable   "
          f"{len(st[0])} stacking facts"
          f"{' on a lattice' if lattice else ' at the crossings'}, "
          f"{int((ev['gp']!=0).sum())} profile votes",
          flush=True)

    u, v, w, tot, S, R = build_edges(ev, cr, n, wcol, wprof)
    rep_cue = {}
    ag, nag = cue_agreement(S, R, n)
    print(f"  the two cues       {len(S[0])} pairs from stacking, {len(R[0])} from "
          f"the profile, {nag} in common   they agree {ag*100:.1f}% "
          f"(chance 50, which would make each right {_p_from_agreement(ag)*100:.0f}%)",
          flush=True)
    rep = float(np.average(S[2] / np.maximum(S[3], EPS), weights=S[3])) \
        if len(S[0]) else 0.0
    print(f"  repeat views       a stacked pair is read "
          f"{len(ev['st'][0])/max(len(S[0]),1):.1f} times on average and those "
          f"readings agree {rep*100:.0f}% of the way", flush=True)
    for tag, g in (("stacking", S), ("profile ", R)):
        fb, fbs = consistency(g[0], g[1], g[2], n)
        print(f"  {tag} alone   {len(g[0])} pairs   {fb*100:.1f}% of its weight "
              f"is a cycle, against {fbs*100:.1f}% with its arrows thrown",
              flush=True)
        rep_cue[tag.strip()] = dict(pairs=int(len(g[0])), feedback=fb,
                                    feedback_shuffled=fbs)

    if thresh is None:
        thresh = float(np.percentile(w, KEEP)) if len(w) else 0.0
    keep = w >= thresh
    u, v, w = u[keep], v[keep], w[keep]
    Xe = 0.5 * (mid[u] + mid[v])
    print(f"  confident subgraph {len(u)} edges at score >= {thresh:.2f}"
          f"   ({len(u)/max(n,1):.2f} a stroke)", flush=True)

    t = time.time()
    pos = gr_arrangement(n, u, v, w)
    fb = feedback(pos, u, v, w)
    rng = np.random.default_rng(18531890)
    sh = rng.random(len(u)) < 0.5
    su_, sv_ = np.where(sh, v, u), np.where(sh, u, v)
    fbs = feedback(gr_arrangement(n, su_, sv_, w), su_, sv_, w)
    print(f"  feedback arc set   {fb*100:.1f}% of the confident weight has to be "
          f"cut to make it acyclic   ({fbs*100:.1f}% with the arrows tossed)"
          f"   {time.time()-t:.0f}s", flush=True)

    rep_ = dict(overlaps=int(len(cr["ia"])), edges=int(len(u)), threshold=thresh,
                live=float(ev["live"].mean()), stacking=int(len(S[0])),
                profile=int(len(R[0])), agree=ag, agree_n=nag,
                repeat=rep, feedback=fb, feedback_shuffled=fbs, lam=lam,
                wcol=wcol, wprof=wprof, cues=rep_cue)
    arclen = float(np.median(cr["arc"][:, -1]))
    if do_audit:
        t = time.time()
        rep_["audit"] = audit(prior, u, v, w, Xe, n, BLOCK * arclen, lam,
                              quiet=quiet)
        a = rep_["audit"]
        print(f"  held out by region {a['edges']} confident crossings, "
              f"{FOLDS} contiguous folds   {time.time()-t:.0f}s")
        print(f"    solver           {a['solver']*100:.1f}%")
        print(f"    heuristic alone  {a['heuristic']*100:.1f}%   "
              f"<- the control BUILD.md M2 asks for")
        print(f"    margin           {a['margin']*100:+.1f} points"
              f"   (exit >= +10, kill < +5)")
        print(f"    arrows tossed    {a['shuffled']*100:.1f}%")
        print(f"    where the habits are silent ({a['near_n']} of them): "
              f"solver {a['solver_near']*100:.1f}%  "
              f"heuristic {a['heuristic_near']*100:.1f}%")
        rep_["block_scan"] = []
        for b in (2.0, 4.0, 8.0, 16.0):
            q = audit(prior, u, v, w, Xe, n, b * arclen, lam, quiet=True)
            rep_["block_scan"].append(dict(block=b, margin=q["margin"],
                                           solver=q["solver"], heur=q["heuristic"]))
        print("    block size       " + "   ".join(
            f"{q['block']:.0f}x{q['margin']*100:+.1f}" for q in rep_["block_scan"])
            + "   (stroke lengths, and the margin at each: a number that moves "
              "with the test is a number about the test)", flush=True)

    r = relax(prior, u, v, w, n, lam=lam)
    o = ranks(r)
    S_ = doc["strokes"]
    lg = legible(o.astype(np.float64), prior,
                 np.array([q["p"][1][1] for q in S_], np.float32),
                 np.array([q["flags"] for q in S_], np.int64),
                 np.array([q["chan"] for q in S_], np.int64))
    rep_["legible"] = lg
    print(f"  the sequence says  top third at {lg['solver']['top']:.2f} of the way "
          f"through, bottom third at {lg['solver']['bottom']:.2f}"
          f"   (the habits: {lg['heuristic']['top']:.2f} and "
          f"{lg['heuristic']['bottom']:.2f}, which know nothing about where)")
    print(f"                     highlights at {lg['solver']['highlight']:.2f}, "
          f"contours at {lg['solver']['contour']:.2f}"
          f"   and the whole sequence still correlates {lg['rho']:.2f} with the "
          f"habits, so what the paint moved is mostly local", flush=True)
    return o, rep_, dict(u=u, v=v, w=w, X=Xe, prior=prior)


def _p_from_agreement(a):
    """Two cues, no ground truth: if their errors are independent and they are
    equally good, the rate at which they agree fixes how good that is.

    a = p^2 + (1-p)^2, so p = (1 + sqrt(2a - 1)) / 2. Independence is an
    assumption and not a small one -- both cues are read off the same fitted
    centreline, so a stroke fitted badly fools both -- which is why this is a
    cross-check printed next to the held-out number and never instead of it.
    """
    if not np.isfinite(a) or a <= 0.5:
        return 0.5
    return 0.5 * (1.0 + math.sqrt(max(2 * a - 1, 0.0)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doc", nargs="?",
                    help="strokes/<out>/<slug>-<tile>.json from extract.py")
    ap.add_argument("--audit", action="store_true", help="measure, write nothing")
    ap.add_argument("--no-audit", action="store_true")
    ap.add_argument("--wcol", type=float, default=1.0)
    ap.add_argument("--wprof", type=float, default=WPROF)
    ap.add_argument("--thresh", type=float, default=None)
    ap.add_argument("--lam", type=float, default=LAM)
    ap.add_argument("--synthetic", action="store_true",
                    help="run the estimator where the true order is known")
    ap.add_argument("--n", type=int, default=3900)
    ap.add_argument("--size", type=int, default=3000)
    ap.add_argument("--rel", type=float, default=0.16)
    ap.add_argument("--alpha", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=18531890)
    ap.add_argument("--lattice", action="store_true",
                    help="also read stacking on a lattice over the whole canvas; "
                         "it sounds better than it measures")
    a = ap.parse_args()

    if a.synthetic:
        return control(a)
    if not a.doc:
        raise SystemExit("give a strokes JSON, or --synthetic")

    import extract as E
    doc = json.load(open(a.doc))
    p = json.load(open(os.path.join(ROOT, "params", doc["slug"] + ".json")))
    work, _ = E.working_image(p, os.path.join(ROOT, p["source"]), verbose=False)
    print(f"{doc['slug']}/{doc['tile']}: {len(doc['strokes'])} strokes", flush=True)

    order, rep, g = solve(doc, work, p, a.wcol, a.wprof, a.thresh, a.lam,
                          do_audit=not a.no_audit, lattice=a.lattice)

    cw, ch = doc["canvas_px"]
    S = doc["strokes"]
    y = np.array([r["p"][1][1] for r in S], np.float32)
    x = np.array([r["p"][1][0] for r in S], np.float32)
    lin = E.srgb_to_linear(np.array([r["rgb"] for r in S], np.float32)[None] / 255.0)
    light = E.lightness(lin)[0]
    width = np.array([r["w"] for r in S], np.float32)
    contour = np.array([(r["flags"] & 1) > 0 for r in S], np.float32)
    highlight = np.array([(r["flags"] & 2) > 0 for r in S], np.float32)
    feat = np.stack([y, x, light, width, contour, highlight], 1).astype(np.float64)
    o, cuts = acts(order, feat)
    named = name_acts(o, cuts, y, light, width, contour, highlight)
    print("  acts               " + "  ".join(
        f"{a_['name']} {a_['count']}" for a_ in named), flush=True)

    if a.audit:
        print("  --audit: nothing written")
        return
    bounds = [a_["first"] for a_ in named[1:]]
    for k, i in enumerate(o):
        S[i]["o"] = float(order[i])
        S[i]["act"] = int(np.searchsorted(bounds, k, "right"))
    doc["order_method"] = 1
    doc["order_report"] = rep
    doc["acts"] = named
    json.dump(doc, open(a.doc, "w"))
    print(f"  -> {os.path.relpath(a.doc, ROOT)}   (order_method 1, "
          f"{len(named)} acts)")


if __name__ == "__main__":
    main()
