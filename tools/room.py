#!/usr/bin/env python3
"""Where the room is. DESIGN.md 4.4's *built* treatment, and its control.

DESIGN 4.4 makes a claim about the interiors and it is the only treatment in
the piece whose justification is a sentence about the paintings rather than a
sentence about the code: *his interiors are already one-point perspective --
the vanishing point gives you the room's proportions directly off the canvas.*

Both halves are testable and they are tested separately, because the first can
be true while the second is worthless.

**Is there a vanishing point at all?** Every stroke is a quadratic through
three points, so it carries a direction. A straight mark lying along a
perspective line points at the vanishing point; a mark of the subject points
wherever the subject goes. So take every straight mark, extend its line in both
directions, and ask which point in the plane the most of them pass nearest. A
canvas with a one-point perspective in it piles the answer up on a spike. A
canvas without one has a broad low mound wherever its marks happen to be
densest, which is not the same thing and has to be told apart from it.

Three ways it is told apart, and the first is the only one that would have been
enough on its own:

  the direction shuffle   Permute the directions between strokes and keep the
                          midpoints. That leaves the spatial arrangement of the
                          marks exactly as it was and destroys only the fan, so
                          the ratio of the real peak to the shuffled peak is the
                          convergence with the composition divided out. This is
                          the same null tools/place.py uses for the horizon and
                          for the same reason.
  the split half          Cut the marks in two at random and find the point
                          twice, from halves that share nothing. Two independent
                          estimates of a real vanishing point land on top of each
                          other; two estimates of a density artifact do not. This
                          is the test that ended up doing the work, and why is
                          below.
  the outdoor controls    The Harvest, the olive grove, the Starry Night and a
                          self-portrait through the same code. A plain has
                          furrows and they converge too, so the interesting
                          question is never "does this fire" but "does this fire
                          harder than a wheatfield".

**Pre-registered, before any canvas was run:** an interior's peak must beat its
own direction shuffle by 3x where the outdoor controls do not, and the three
Bedrooms -- three canvases, three collections, three scans at 329, 203 and 78
px/cm -- must put their vanishing points within 2% of the canvas of each other
before "the three Bedrooms occupy the same space" is a measurement rather than
a staging trick. Nothing in the code makes them agree: each is measured alone
and they are compared afterwards.

**The pre-registered ratio failed, and the reason it failed is a fact about the
instrument rather than about the paintings.** --sensitivity runs the calibration
that shows it: take a canvas's own marks, keep every midpoint and every length,
and re-point a fraction f of them at one chosen place with three degrees of
hand-jitter. Then f is known and the answer can be graded.

    f      0.00    0.05    0.10    0.20    0.35    0.50    1.00
    ratio  1.25x   1.31x   1.44x   1.98x   3.47x   4.82x   9.14x
    found  wrong   wrong   2.2%    0.8%    0.5%    0.3%    0.2%     from the truth

The height of the peak is a statement about *how much of the paint* lies on the
room's lines, and it does not reach 3x until a third of every mark on the canvas
is a perspective line. No painting is like that: the walls are painted with wall
and the bed with bed. But the *location* is already right at a tenth, where the
ratio is still an unremarkable 1.44 -- so the pre-registered bar was set on a
quantity that answers a different question, and asking it of a painting was the
error. The ratio is kept and reported, because a test that was made and failed
is worth more than a test quietly replaced.

**What replaces it is the split half, at the bar this file already had.** The
room only has to be located well enough that the room it gives is right, and
that requirement is the 2% already written above for the three Bedrooms: it is
not a new number chosen after seeing the data, it is the old one asked of a
second thing. So: cut the marks in half at random, find the point in each half
alone, and the two must land within 2% of the canvas of each other. Against
the direction shuffle, which has no point to find, the same split scatters.

**Then the room, and this is the half that is nearly free.** Put the window's
own axis through the vanishing point, which is what a vanishing point is: the
direction the painter was facing. Then a canvas point (u, v) is the ray

    x = (u - u0) * aspect,   y = v0 - v,   z = -fz

and the room is the box that ray hits. Give it the four edges of the back wall
-- and those are *authored*, four numbers a person reads off the canvas, in the
station file where they can be argued with -- and the rest is arithmetic:

    D  = h * fz / s                 the back wall, in metres
    XL = h * (u0 - ul) * aspect / s        the room, to the left of the axis
    XR = h * (ur - u0) * aspect / s        and to the right
    H  = h * (1 + (v0 - vc) / s)           floor to ceiling
                                    where s = vf - v0, the back wall's own
                                    floor line below the vanishing point

**The width and the height of the room cost nothing at all.** fz cancels out
of every one of them: they are in units of the painter's eye height and
nothing else, so the room's cross-section really does come off the canvas with
no free constant in it. Only the *depth* needs fz, which is M3's one declared
number -- how wide the canvas is taken to be from where he stood -- and it is
50 degrees there and it is 50 degrees here.

    tools/room.py strokes/s05/bedroom1-canvas.json stations/s05-yellow-house.json
    tools/room.py strokes/s05/bedroom1-canvas.json --audit
    tools/room.py --compare strokes/s05/bedroom{1,2,3}-canvas.json
"""
import argparse, json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

EPS = 1e-12
SIGMA = 0.02           # canvas heights: how near a line must pass to vote for a point
LONG = 75.0            # percentile of arc length. a short mark has no direction worth having
TURN_MAX = 0.25        # rad. curl.py's floor, from the other side: below it, a mark is a line
SPAN = (-0.6, 1.6)     # where the vanishing point is allowed to be, in canvas fractions
COARSE = 0.02          # first pass, one sigma
FINE = 0.002           # second pass, over +-5% of the canvas around the coarse peak
SHUF = 24              # direction shuffles for the null
SPLITS = 12            # random half-and-half cuts, for the test that ships
RATIO_MIN = 3.0        # PRE-REGISTERED: an interior beats its own shuffle by this
AGREE_MAX = 0.02       # PRE-REGISTERED: three repetitions of one room agree within
                       # this -- and, unchanged, what two halves of one canvas
                       # must agree within before the point is worth building on
JITTER = 3.0           # degrees of hand, for the --sensitivity calibration
SCAN_W = 1600.0        # px. the width the scan is asked at, for --scan
SCAN_MIN = 0.03        # ... and the shortest segment worth a vote, in canvas heights
REG_W = 900.0          # px. the width two canvases are compared at
REG_SIG = 6.0          # px at that width: the high pass that leaves the drawing
REG_BLK = 0.10         # block side, in canvas heights
REG_SEARCH = 0.12      # how far a block is allowed to have moved
REG_NCC = 0.35         # and how well it has to match when it gets there
REG_MARGIN = 1.25      # ... beating its own second best by this, which is Lowe's idea
REG_SAME = 0.03        # this fraction of blocks finding themselves is the same picture.
                       # Set by looking, and honest about it: what is *not* set by
                       # looking is the separation, which survives all 27 combinations
                       # of width, block and threshold that were tried -- the three
                       # Bedrooms score 2-19% and every control 0-1%, and only at the
                       # loosest setting of all do the two populations touch.
SEED = 18531890
HFOV = 50.0            # degrees, DESIGN 4.4's one free constant, same as place.py
EYE = 1.65             # m, DESIGN 6


# ------------------------------------------------------------- the marks ------

def lines(doc):
    """Straight marks, as (midpoint, unit direction, weight), canvas-normalised.

    Canvas coordinates are square here -- u times the aspect -- so that a
    perpendicular distance means the same thing in both axes, which it does not
    in the (u, v) the record is stored in.
    """
    s = doc["strokes"]
    P = np.array([r["p"] for r in s], np.float64)
    arc = np.array([r["arc"] for r in s], np.float64)
    flags = np.array([r["flags"] for r in s], np.int32)
    cw, ch = doc["canvas_px"]
    asp = doc["canvas_px"][0] / doc["canvas_px"][1]
    A = P * np.array([asp, 1.0])                    # square canvas units
    mid = 0.25 * A[:, 0] + 0.5 * A[:, 1] + 0.25 * A[:, 2]
    d = A[:, 2] - A[:, 0]
    L = np.hypot(d[:, 0], d[:, 1])

    # how much a mark turns: the circle through its two ends and its own Bezier
    # midpoint, exactly as tools/curl.py builds it. A mark that turns is not a
    # perspective line however long it is.
    a_, m_, c_ = A[:, 0], mid, A[:, 2]
    det = 2.0 * (a_[:, 0] * (m_[:, 1] - c_[:, 1])
                 + m_[:, 0] * (c_[:, 1] - a_[:, 1])
                 + c_[:, 0] * (a_[:, 1] - m_[:, 1]))
    sa, sm, sc = (a_ ** 2).sum(1), (m_ ** 2).sum(1), (c_ ** 2).sum(1)
    with np.errstate(divide="ignore", invalid="ignore"):
        ox = (sa * (m_[:, 1] - c_[:, 1]) + sm * (c_[:, 1] - a_[:, 1])
              + sc * (a_[:, 1] - m_[:, 1])) / det
        oy = (sa * (c_[:, 0] - m_[:, 0]) + sm * (a_[:, 0] - c_[:, 0])
              + sc * (m_[:, 0] - a_[:, 0])) / det
        r = np.hypot(a_[:, 0] - ox, a_[:, 1] - oy)
        turn = np.where(np.isfinite(r) & (r > EPS), L / np.maximum(r, EPS), 0.0)
    turn = np.where(np.isfinite(turn), turn, 0.0)

    keep = ((flags & 1) == 0) & ((flags & 8) == 0) & (L > EPS)
    if keep.sum() < 50:
        return None
    cut = np.percentile(arc[keep], LONG)
    keep &= (arc >= cut) & (turn < TURN_MAX)
    if keep.sum() < 100:
        return None
    d = d[keep] / L[keep][:, None]
    return dict(mid=mid[keep], d=d, w=arc[keep] / max(arc[keep].sum(), EPS),
                n=int(keep.sum()), aspect=asp,
                straight=float(keep.sum()) / max(int(((flags & 1) == 0).sum()), 1))


def segments(slug, width=SCAN_W, verbose=True):
    """The same question asked of the scan instead of the stroke record.

    The strokes are a record of *paint*, and a painting of a room is mostly
    paint that is not the room: wall, bed, floorboard colour. If the vanishing
    point is in the picture but not in the marks, then the failure is the
    record's and not the painter's -- and the only way to tell those apart is
    to ask something that is not the record. So: the working image the
    extractor already cached, at a fixed width, through a line segment
    detector, and then through *exactly* the same vote, the same split half and
    the same shuffle. Nothing else changes, which is the point.
    """
    import cv2
    a = np.load(os.path.join(ROOT, "ref", "work", slug + ".npy"), mmap_mode="r")
    H, W = a.shape[:2]
    k = width / W
    im = cv2.resize(np.asarray(a), (int(width), int(round(H * k))),
                    interpolation=cv2.INTER_AREA)
    g = cv2.cvtColor(im, cv2.COLOR_RGB2GRAY)
    lsd = cv2.createLineSegmentDetector()
    seg = lsd.detect(g)[0]
    if seg is None or len(seg) < 100:
        return None
    seg = seg.reshape(-1, 4)
    h = im.shape[0]
    P = seg.reshape(-1, 2, 2) / h                      # square units: height = 1
    d = P[:, 1] - P[:, 0]
    L = np.hypot(d[:, 0], d[:, 1])
    keep = L >= SCAN_MIN
    P, d, L = P[keep], d[keep] / np.maximum(L[keep], EPS)[:, None], L[keep]
    if len(L) < 100:
        return None
    if verbose:
        print(f"  scan  {int(width)}x{im.shape[0]}, {len(seg)} segments detected, "
              f"{len(L)} at least {SCAN_MIN*100:.0f}% of the canvas height long")
    return dict(mid=0.5 * (P[:, 0] + P[:, 1]), d=d, w=L / max(L.sum(), EPS),
                n=int(len(L)), aspect=im.shape[1] / im.shape[0],
                straight=float(len(L)) / max(len(seg), 1))


def register(slugs, width=REG_W, verbose=True):
    """Are these canvases the same picture? Ask the pictures, not the marks.

    This is the measurement station 5 is actually for. DESIGN 7 wants the three
    Bedrooms occupying one space, and whether they *can* is a question about the
    canvases rather than about the staging: three repetitions of one room either
    line up or they do not.

    Feature matching is the obvious tool and it is the wrong one here -- a
    canvas of repeated brushwork fails Lowe's ratio nearly everywhere, and SIFT
    found forty matches between two Bedrooms of which five survived. Fitting a
    homography is worse: eight degrees of freedom will fold a wheatfield onto a
    bedroom, and it did, at a correlation as high as the two bedrooms scored.

    So: **block matching, at the same canvas fractions, with no global fit at
    all.** Both scans at one width, high-passed so it is the drawing that is
    compared and not the tone -- which matters, because the whole point of these
    three canvases is that the tone is different. Then every block of one canvas
    is looked for in a window of the other, and a block counts only if its best
    match beats its own second-best by a margin, which is Lowe's idea applied
    where it works. What comes out is two numbers with nothing tuned between
    them: **how many blocks find themselves**, and **how far they had to go**.

    The control is the same code between a Bedroom and a wheatfield, and between
    two wheatfields, which have the same horizon in the same place and are still
    not the same picture.
    """
    import cv2
    ims = []
    for sl in slugs:
        a = np.load(os.path.join(ROOT, "ref", "work", sl + ".npy"), mmap_mode="r")
        H, W = a.shape[:2]
        im = cv2.resize(np.asarray(a), (int(width), int(round(H * width / W))),
                        interpolation=cv2.INTER_AREA)
        g = cv2.cvtColor(im, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        # the drawing, not the tone. Three versions of one room differ in colour
        # on purpose, so a comparison that reads colour answers the wrong question.
        ims.append(g - cv2.GaussianBlur(g, (0, 0), REG_SIG * width / 900.0))

    def pair(A, B):
        hA, wA = A.shape
        B = cv2.resize(B, (wA, hA), interpolation=cv2.INTER_AREA)
        b, sr = int(REG_BLK * hA), int(REG_SEARCH * hA)
        conf, tried, offs = 0, 0, []
        for y in range(0, hA - b, max(b // 2, 1)):
            for x in range(0, wA - b, max(b // 2, 1)):
                t = A[y:y + b, x:x + b]
                if t.std() < 1e-3:
                    continue
                y0, y1 = max(0, y - sr), min(hA, y + b + sr)
                x0, x1 = max(0, x - sr), min(wA, x + b + sr)
                if y1 - y0 < b + 4 or x1 - x0 < b + 4:
                    continue
                tried += 1
                r = cv2.matchTemplate(B[y0:y1, x0:x1], t, cv2.TM_CCOEFF_NORMED)
                _, mx, _, loc = cv2.minMaxLoc(r)
                rr, xx, yy = r.copy(), loc[0], loc[1]
                rr[max(0, yy - b // 4):yy + b // 4, max(0, xx - b // 4):xx + b // 4] = -1
                if mx >= REG_NCC and mx >= REG_MARGIN * max(float(rr.max()), 1e-3):
                    conf += 1
                    offs.append(((x0 + xx) - x, (y0 + yy) - y))
        o = np.array(offs, np.float64).reshape(-1, 2) / hA
        d = dict(tried=tried, conf=conf, frac=conf / max(tried, 1))
        if len(o) >= 8:
            bias = np.median(o, 0)
            res = o - bias
            d.update(moved=float(np.median(np.hypot(o[:, 0], o[:, 1]))),
                     bias=[float(bias[0]), float(bias[1])],
                     resid=float(np.median(np.hypot(res[:, 0], res[:, 1]))),
                     resid90=float(np.percentile(np.hypot(res[:, 0], res[:, 1]), 90)))
        return d

    out = []
    for i in range(len(slugs)):
        for j in range(i + 1, len(slugs)):
            r = pair(ims[i], ims[j])
            r.update(a=slugs[i], b=slugs[j],
                     same=bool(r["frac"] >= REG_SAME))
            out.append(r)
    if verbose:
        print(f"do these show the same picture?  {int(width)} px, "
              f"{REG_BLK*100:.0f}% blocks, matched inside {REG_SEARCH*100:.0f}%, "
              f"kept above {REG_NCC:.2f} and {REG_MARGIN:.2f}x their own second best")
        print(f"  {'pair':<24s} {'blocks found themselves':>24s} {'moved':>7s}"
              f" {'net':>15s} {'left over':>10s}")
        for r in out:
            if "moved" not in r:
                print(f"  {r['a']+' / '+r['b']:<24s} {r['conf']:>10d} of {r['tried']:<11d}"
                      f"   nothing lines up   ==> NOT the same picture")
                continue
            print(f"  {r['a']+' / '+r['b']:<24s} {r['conf']:>10d} of {r['tried']:<4d}"
                  f" ({r['frac']*100:>3.0f}%) {r['moved']*100:>6.2f}%"
                  f" {r['bias'][0]*100:>+6.2f},{r['bias'][1]*100:>+6.2f}%"
                  f" {r['resid']*100:>9.2f}%"
                  f"   {'THE SAME' if r['same'] else 'NOT the same'}")
        print(f"  'net' is how the composition is framed differently between the two;"
              f" 'left over' is what")
        print(f"  moved once that is taken out, and it is the number that says whether"
              f" one room fits all three.")
    return out


def _peak(mid, d, w, xs, ys, sigma=SIGMA, chunk=64):
    """The vote surface's maximum over a grid, and where it is.

    A line through `mid` with unit direction `d` passes a point q at
    perpendicular distance |d x (q - mid)|, so the vote is one cross product
    per (stroke, point) and the kernel is the tolerance that says how near
    "passes through" is.
    """
    best, bx, by = -1.0, xs[0], ys[0]
    inv = -0.5 / (sigma * sigma)
    for i in range(0, len(ys), chunk):
        yy = ys[i:i + chunk]
        # (rows, cols, strokes)
        dx = xs[None, :, None] - mid[None, None, :, 0]
        dy = yy[:, None, None] - mid[None, None, :, 1]
        per = d[None, None, :, 0] * dy - d[None, None, :, 1] * dx
        v = (np.exp(inv * per * per) * w[None, None, :]).sum(2)
        k = int(np.argmax(v))
        if v.flat[k] > best:
            best = float(v.flat[k])
            by, bx = yy[k // len(xs)], xs[k % len(xs)]
    return best, bx, by


def _vote(mid, d, w, sigma=SIGMA):
    """Coarse pass over the whole allowed span, then a fine pass around it."""
    xs = np.arange(SPAN[0], SPAN[1] + EPS, COARSE)
    ys = np.arange(SPAN[0], SPAN[1] + EPS, COARSE)
    _, bx, by = _peak(mid, d, w, xs, ys, sigma)
    fx = np.arange(bx - 0.05, bx + 0.05 + EPS, FINE)
    fy = np.arange(by - 0.05, by + 0.05 + EPS, FINE)
    return _peak(mid, d, w, fx, fy, sigma)


def _split(mid, d, w, rng, n=SPLITS):
    """Find the point twice from halves that share no mark, n times over.

    Two independent estimates of something that is there land on top of each
    other. Two estimates of the place the marks merely happen to be densest do
    not, because the density has no particular place in it and each half's
    accident is its own.
    """
    out = []
    for _ in range(n):
        k = rng.permutation(len(d))
        a, b = k[:len(k) // 2], k[len(k) // 2:]
        _, x1, y1 = _vote(mid[a], d[a], w[a] / max(w[a].sum(), EPS))
        _, x2, y2 = _vote(mid[b], d[b], w[b] / max(w[b].sum(), EPS))
        out.append(math.hypot(x1 - x2, y1 - y2))
    return float(np.median(out))


def sensitivity(doc, at=(0.52, 0.50), seed=SEED, fracs=(0.0, 0.05, 0.10, 0.20,
                                                        0.35, 0.50, 0.75, 1.0)):
    """What does this instrument need before it fires? Grade it on a known answer.

    The same marks, the same midpoints, the same lengths -- and a fraction f of
    them re-pointed at one place with a few degrees of hand in them. Everything
    about the canvas that is not the perspective is left exactly as it is, which
    is what makes this a calibration of the instrument rather than a simulation
    of a painting.
    """
    L = lines(doc)
    if L is None:
        return None
    rng = np.random.default_rng(seed)
    mid, d, w, asp = L["mid"], L["d"], L["w"], L["aspect"]
    vp = np.array([at[0] * asp, at[1]])
    rows = []
    for f in fracs:
        dd = d.copy()
        k = rng.random(len(d)) < f
        if k.any():
            v = vp[None, :] - mid[k]
            th = np.arctan2(v[:, 1], v[:, 0]) + rng.normal(0, math.radians(JITTER),
                                                           int(k.sum()))
            dd[k] = np.stack([np.cos(th), np.sin(th)], 1)
        peak, x, y = _vote(mid, dd, w)
        null = float(np.median([_vote(mid, dd[rng.permutation(len(dd))], w)[0]
                                for _ in range(8)]))
        half = _split(mid, dd, w, rng, n=4)
        rows.append(dict(f=float(f), peak=peak, null=null,
                         ratio=float(peak / max(null, EPS)),
                         off=float(math.hypot(x - vp[0], y - vp[1])), half=half))
    print(f"{doc['slug']}/{doc['tile']}: calibration on {L['n']} of its own marks, "
          f"re-pointed at u {at[0]:.2f} v {at[1]:.2f} with {JITTER:.0f} deg of hand")
    print(f"  {'f':>6s} {'peak':>7s} {'null':>7s} {'ratio':>7s} {'found off by':>13s}"
          f" {'two halves':>11s}")
    for r in rows:
        print(f"  {r['f']:>6.2f} {r['peak']:>7.4f} {r['null']:>7.4f} {r['ratio']:>6.2f}x"
              f" {r['off']*100:>12.1f}% {r['half']*100:>10.1f}%")
    print(f"  the ratio needs about a third of every mark on the canvas to be a "
          f"perspective line before it reaches {RATIO_MIN:.0f}x;")
    print(f"  the location is already right at a tenth, and so is the split half. "
          f"That is why the ratio is not the test.")
    return rows


def vanishing(doc, seed=SEED, verbose=True, L=None, what="straight marks"):
    """The point the straight marks point at, and whether that means anything."""
    if L is None:
        L = lines(doc)
    if L is None:
        return None
    rng = np.random.default_rng(seed)
    mid, d, w = L["mid"], L["d"], L["w"]
    peak, x, y = _vote(mid, d, w)
    null = np.array([_vote(mid, d[rng.permutation(len(d))], w)[0]
                     for _ in range(SHUF)])
    half = _split(mid, d, w, rng)
    shuf = d[rng.permutation(len(d))]
    half_null = _split(mid, shuf, w, rng)

    # who voted, and from how many directions. A bundle of parallels is not a
    # point however loud it is, so this is the test the shuffle cannot do.
    per = d[:, 0] * (y - mid[:, 1]) - d[:, 1] * (x - mid[:, 0])
    k = np.exp(-0.5 * (per / SIGMA) ** 2) * w
    th = np.arctan2(d[:, 1], d[:, 0]) * 2.0                  # mod pi: a line has no arrow
    R = abs(complex(float((k * np.cos(th)).sum()), float((k * np.sin(th)).sum()))) \
        / max(float(k.sum()), EPS)
    spread = math.degrees(math.sqrt(max(-2.0 * math.log(max(R, 1e-9)), 0.0)) / 2.0)

    med = float(np.median(null))
    rep = dict(u=float(x / L["aspect"]), v=float(y), peak=peak, null=med,
               ratio=float(peak / max(med, EPS)), n=L["n"],
               over=int((null < peak).sum()), trials=int(len(null)),
               spread_deg=spread, on_lines=float(k.sum()),
               straight_frac=L["straight"], sigma=SIGMA, ratio_min=RATIO_MIN,
               half=half, half_null=half_null, agree_max=AGREE_MAX,
               stable=bool(half <= AGREE_MAX))
    if verbose:
        print(f"{doc['slug']}/{doc['tile']}: {L['n']} {what} "
              f"({L['straight']*100:.0f}% of what was on offer was long and straight enough)")
        print(f"  vanishing point     u {rep['u']:.4f}  v {rep['v']:.4f}"
              f"   ({rep['u']*100:.1f}% across, {rep['v']*100:.1f}% down)")
        print(f"  two halves agree    {half*100:.2f}% of the canvas apart"
              f"   (shuffled, {half_null*100:.1f}%: {half_null/max(half,EPS):.1f}x worse)"
              f"   {'STABLE' if rep['stable'] else 'not stable'}"
              f" at the {AGREE_MAX*100:.0f}% this file already asks of three canvases")
        print(f"  height of the peak  {rep['ratio']:.2f}x its own direction shuffle"
              f"   ({'fires' if rep['ratio'] >= RATIO_MIN else 'does not fire'}"
              f" at the pre-registered {RATIO_MIN}x, which --sensitivity shows was"
              f" the wrong quantity to have asked)")
        print(f"  spread of the fan   {spread:.1f} deg"
              f"   (a single family of parallels scores near zero)")
        print(f"  paint on its lines  {rep['on_lines']*100:.1f}% of the straight marks' length"
              f"   -- the rest is the subject, not the room")
    return rep


# --------------------------------------------------------------- the room ----

def build(vp, back, aspect, eye=EYE, hfov=HFOV):
    """The box the window's rays hit, in metres, from the vanishing point.

    `back` is the authored back wall: [u_left, u_right, v_ceiling, v_floor] in
    canvas fractions, and `vp` is the vanishing point -- **also authored**, for
    the reason the module docstring gives at length: this file went looking for
    it in the strokes and in the scan's own line segments and could not find it
    reproducibly on any canvas in the piece. So both are a person reading a
    painting and typing, exactly as tools/shell.py's depths are.

    What is *not* authored is everything below this line. Given those six
    numbers and DESIGN 6's eye height, the room follows -- and the width and the
    height follow with no free constant in them at all, because fz cancels.
    """
    ul, ur, vc, vf = [float(t) for t in back]
    u0, v0 = float(vp["u"]), float(vp["v"])
    s = vf - v0
    if s <= 1e-4:
        raise SystemExit("the back wall's floor line is not below the vanishing point; "
                         "check the authored `back` against the canvas")
    fz = (aspect / 2.0) / math.tan(math.radians(hfov) / 2.0)
    return dict(eye=eye, hfov=hfov, fz=fz, u0=u0, v0=v0, back=[ul, ur, vc, vf],
                depth=eye * fz / s,
                left=eye * (u0 - ul) * aspect / s,
                right=eye * (ur - u0) * aspect / s,
                ceil=eye * (1.0 + (v0 - vc) / s))


def report_room(r, verbose=True):
    if not verbose:
        return
    w = r["left"] + r["right"]
    print(f"  the room            {w:.2f} m wide, {r['ceil']:.2f} m to the ceiling,"
          f" {r['depth']:.2f} m to the back wall")
    print(f"                      floor {w * r['depth']:.1f} m2,"
          f" {w * r['depth'] * r['ceil']:.1f} m3,"
          f" axis {r['left']:.2f} m from the left wall and {r['right']:.2f} from the right")
    print(f"                      width and height carry no free constant; the depth "
          f"carries one, hfov {r['hfov']:.0f} deg")


# ------------------------------------------------------------ do they agree --

def compare(reps, names, verbose=True):
    """Three canvases of one room: do they put the room in the same place?"""
    u = np.array([r["vp"]["u"] for r in reps])
    v = np.array([r["vp"]["v"] for r in reps])
    asp = np.array([r["aspect"] for r in reps])
    x = u * asp
    worst, pair = 0.0, (0, 0)
    for i in range(len(reps)):
        for j in range(i + 1, len(reps)):
            d = math.hypot(x[i] - x[j], v[i] - v[j])
            if d > worst:
                worst, pair = d, (i, j)
    out = dict(worst=worst, pair=[names[pair[0]], names[pair[1]]],
               agrees=bool(worst <= AGREE_MAX),
               u=[float(t) for t in u], v=[float(t) for t in v])
    if any(r.get("room") for r in reps):
        for k in ("depth", "ceil", "left", "right"):
            g = [r["room"][k] for r in reps if r.get("room")]
            out[k] = dict(vals=[float(t) for t in g], mean=float(np.mean(g)),
                          spread=float((max(g) - min(g)) / max(np.mean(g), EPS)))
    if verbose:
        print("do the three agree:")
        for n, a, b in zip(names, u, v):
            print(f"  {n:<24s} vanishing point at u {a:.4f}  v {b:.4f}")
        print(f"  worst disagreement  {worst*100:.2f}% of the canvas"
              f"  ({out['pair'][0]} against {out['pair'][1]})"
              f"   {'AGREE' if out['agrees'] else 'DISAGREE'}"
              f" at the pre-registered {AGREE_MAX*100:.0f}%")
        for k, lab in (("depth", "to the back wall"), ("ceil", "to the ceiling")):
            if k in out:
                g = out[k]
                print(f"  {lab:<19s} " + ", ".join(f"{t:.2f} m" for t in g["vals"])
                      + f"   spread {g['spread']*100:.1f}% of the mean")
    return out


def find_spec(station, blob):
    for c in station.get("canvases", []):
        if os.path.basename(c["blob"]) == os.path.basename(blob):
            return c
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json", nargs="*")
    ap.add_argument("station", nargs="?", default=None)
    ap.add_argument("--audit", action="store_true", help="measure, write nothing")
    ap.add_argument("--compare", action="store_true",
                    help="several canvases of one room: do they agree")
    ap.add_argument("--sensitivity", action="store_true",
                    help="grade the instrument on a known answer")
    ap.add_argument("--scan", action="store_true",
                    help="ask the scan's own line segments instead of the strokes")
    ap.add_argument("--register", nargs="+", metavar="SLUG", default=None,
                    help="do these canvases show the same thing?")
    a = ap.parse_args()

    if a.register:
        register(a.register)
        return

    # `station` only means anything in the one-canvas form; --compare takes a list
    paths = list(a.json)
    if a.station:
        paths.append(a.station)
    station = None
    if not a.compare and len(paths) > 1 and paths[-1].endswith(".json") \
            and os.path.basename(paths[-1]).startswith("s0"):
        station = json.load(open(paths.pop()))

    reps, names = [], []
    for p in paths:
        doc = json.load(open(p))
        if a.sensitivity:
            sensitivity(doc)
            continue
        vp = (vanishing(doc, L=segments(doc["slug"]), what="line segments")
              if a.scan else vanishing(doc))
        if vp is None:
            print(f"{os.path.basename(p)}: too few straight marks to ask")
            continue
        aspect = doc["canvas_px"][0] / doc["canvas_px"][1]
        rep = dict(vp=vp, aspect=aspect)
        spec = find_spec(station, os.path.splitext(p)[0] + ".bin") if station else None
        if spec and spec.get("back"):
            ax = spec.get("axis")
            axis = dict(u=float(ax[0]), v=float(ax[1])) if ax else vp
            if ax:
                d = math.hypot((axis["u"] - vp["u"]) * aspect, axis["v"] - vp["v"])
                print(f"  the axis is authored  u {axis['u']:.3f} v {axis['v']:.3f}"
                      f"   ({d*100:.0f}% of the canvas from where the vote landed,"
                      f" which is not evidence either way: the vote is not stable)")
            rep["room"] = build(axis, spec["back"], aspect,
                                eye=float(station.get("eye", EYE)),
                                hfov=float(spec.get("hfov", HFOV)))
            rep["room"]["authored"] = bool(ax)
            report_room(rep["room"])
        reps.append(rep)
        names.append(f"{doc['slug']}/{doc['tile']}")
        if not a.compare and not a.audit:
            doc["room"] = dict(rep["vp"], **({"box": rep["room"]} if "room" in rep else {}))
            json.dump(doc, open(p, "w"))
            print(f"  wrote the vanishing point into {os.path.relpath(p, ROOT)}")
        elif a.audit:
            print("  --audit: nothing written")

    if a.compare and len(reps) > 1:
        compare(reps, names)


if __name__ == "__main__":
    main()
