#!/usr/bin/env python3
"""Where a canvas stands. DESIGN.md 4.4's *lifted* treatment, and its control.

A painting is flat and the station is not. The lifted treatment says: ground
strokes onto a heightfield, sky strokes onto a dome. Both halves of that
sentence assume a line -- the horizon -- and the ground half assumes a law: how
fast the plain recedes. This module measures both from the strokes, and reports
the two numbers that say whether the measurement means anything.

**The horizon, twice, from unrelated signals.**

  colour   The row that best splits the canvas into two colour populations,
           by between-class scatter in Lab weighted by arc length. Direction
           agnostic on purpose: the Reaper's sky is blue over yellow and the
           Sower's is yellow over violet, so any rule of the form "sky is the
           blue one" is a rule about two canvases rather than about painting.
  size     Marks on a receding plane shrink with distance, so their apparent
           size falls to zero *at* the horizon. Fit stroke size against height
           on the canvas and read off where the fit crosses zero. This uses no
           colour at all, and it is a prediction: the two lines should land on
           top of each other, and nothing in either method makes them.

The second one returned nothing, and the shape of the nothing is the finding.
Mark size on these canvases is flat to a few percent across the whole depth of
the picture, and what drift there is runs the wrong way -- so there is no zero
crossing to read, the prediction cannot be tested, and the "size" row above
survives as the test that was made and failed rather than as a method. The
horizon that ships is the colour split alone, and what says it is a horizon
rather than merely the strongest boundary on the canvas is that it is
*horizontal*: see horizon_colour.

**The recession, with the confound named.** If size falls as (v - v_h)^gamma,
then distance goes as (v - v_h)^-gamma, because apparent size is always 1/d.
gamma = 1 is a true perspective plane; gamma = 0 is a flat backdrop with a
horizon painted on it. So gamma is a number for how perspectival a Van Gogh
actually is, and it is the law the runtime lifts the ground with.

What it cannot do is say *why*. A painter reaches for a smaller brush to paint
the far side of a field, and that produces exactly the same gradient as optics.
The measurement is of the canvas's own foreshortening, and it is silent on
whether that came from the eye or from the hand. It is still the right number
to lift the ground with -- it is what the canvas says the distance is -- but
"the plain recedes because the paint says so" is the claim, not "because the
optics say so".

**Three controls, all of them able to return nothing.**

  shuffled colours   The colour split's peak against the same peak with the
                     stroke colours permuted between strokes. A canvas with no
                     two populations gives the same number both ways.
  the sky            The size gradient fitted to the sky strokes instead. A
                     dome has no texture gradient; if the sky slopes as hard as
                     the ground, what is being measured is the composition, not
                     a plane.
  shuffled heights   The gradient with the strokes' heights on the canvas
                     permuted among themselves. This is the null the slope has
                     to beat, and it is quoted as a percentile rather than a
                     p-value because 19,000 strokes make any effect significant.

**And two ways the estimate can be flattened without warning.** Widths are
clipped to plausible paint at both ends (params width_min/width_max) and arcs
at min_arc, so a far-field stroke that ought to be half a millimetre is
recorded at 1.2 mm. Clipping only ever *reduces* gamma, so the fraction clipped
is reported next to it: a gamma measured with a fifth of the far field on the
floor is a lower bound and should be read as one.

    tools/place.py strokes/m3/reaper-canvas.json            # measure and write
    tools/place.py strokes/m3/reaper-canvas.json --audit    # measure, write nothing
"""
import argparse, json, math, os, sys, time
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

EPS = 1e-12
VLO, VHI = 0.04, 0.80       # a horizon is somewhere in here or it is not a horizon
VSTEP = 0.002               # 0.2% of the canvas: finer than a stroke is wide
NBIN = 20                   # equal-count bins for the size fit
SHUF = 40                   # shuffles for the colour null
SHUF_V = 400                # and for the slope null, which is one cheap fit
GUARD = 0.02                # the strip just under the horizon, where log blows up
DENS_FRAC = 0.25            # the plain has thinned when a quarter of the paint is left
HFOV = 50.0                 # degrees. a choice, not a measurement -- see place()
EYE = 1.65                  # DESIGN 6. the only thing setting the scale of the world
DOME = 90.0                 # m. where the sky is, and the cap on how far paint goes
GAMMA_LIFT = 0.5            # below this the canvas is a wall, not a plain
HORIZON_RATIO = 5.0         # a horizon beats its own column control by this much.
                            # Pre-registered at 2.0 and wrong: the two canvases
                            # that are not places came back at 2.1 (the Getty
                            # Irises, all ground and no horizon at all) and 2.4
                            # (a self-portrait), so 2.0 would have called a bed
                            # of irises a plain by a tenth. The three places
                            # score 11, 39 and 72. The controls put the line in
                            # the gap, which is the only thing in this file that
                            # knows where it goes -- and it is set by two
                            # negative controls, which is two more than a
                            # threshold usually gets and fewer than it deserves.
SEED = 18531890


# ---------------------------------------------------------------- the strokes --

def features(doc):
    """Midpoint, size and colour per stroke, in canvas-normalised coordinates.

    Contours and edge-spill strokes are dropped from the size fits and only
    from those: a contour is an outline rather than a mark of the subject, and
    a stroke running off the edge of the canvas has been cut by the frame, so
    its length is a fact about the crop. Both would bias the gradient, and the
    spill one biases it toward zero at the bottom edge, which is where the
    gradient is largest and therefore where it can do the most damage.
    """
    import extract as E
    s = doc["strokes"]
    P = np.array([r["p"] for r in s], np.float64)               # n,3,2
    mid = 0.25 * P[:, 0] + 0.5 * P[:, 1] + 0.25 * P[:, 2]
    arc = np.array([r["arc"] for r in s], np.float64)           # px
    wid = np.array([r["w"] for r in s], np.float64)             # of the short edge
    flags = np.array([r["flags"] for r in s], np.int32)
    rgb = np.array([r["rgb"] for r in s], np.float64)[None]   # 0..255, see srgb_to_linear
    lab = E.linear_to_lab(E.srgb_to_linear(rgb))[0]
    keep = ((flags & 1) == 0) & ((flags & 8) == 0)
    return dict(mid=mid, u=mid[:, 0], v=mid[:, 1], arc=arc, wid=wid,
                lab=lab, flags=flags, keep=keep, P=P)


# ------------------------------------------------------- the horizon by colour --

def _scan(proj, lab, w, offs):
    """Between-class scatter for every candidate cut along one direction.

    Otsu's criterion in three dimensions -- w1 w2 ||mu1 - mu2||^2 -- which is
    what a two-population split maximises whatever the direction of the colour
    difference is. Cumulative sums make the whole scan cost one sort, and the
    sort is hoisted out so the shuffled null re-uses it.
    """
    o = np.argsort(proj, kind="stable")
    ps, ls, ws = proj[o], lab[o], w[o]
    cw = np.r_[0.0, np.cumsum(ws)]
    cl = np.vstack([np.zeros(3), np.cumsum(ls * ws[:, None], 0)])
    i = np.searchsorted(ps, offs)
    w1, w2 = cw[i], cw[-1] - cw[i]
    m1 = cl[i] / np.maximum(w1, EPS)[:, None]
    m2 = (cl[-1] - cl[i]) / np.maximum(w2, EPS)[:, None]
    d2 = ((m1 - m2) ** 2).sum(1)
    return np.where((w1 > EPS) & (w2 > EPS),
                    w1 * w2 / max(cw[-1], EPS) ** 2 * d2, 0.0), o


def horizon_colour(f, aspect, seed=SEED):
    """Is there a horizon, and where.

    Two questions, and the first one decides the treatment. A horizon is not
    merely the strongest colour boundary on a canvas -- every picture has one
    of those, including a face -- it is a boundary that is *horizontal*. So the
    same split is scanned across the rows and again down the columns, and what
    is reported is how much better the best level cut is than the best upright
    one. The canvases that are not places are run through the same code as the
    negative controls, and they are the only reason to believe the number.

    A tilt scan was here and has been taken out. The idea was that a horizon a
    degree or two off level is a fact about how he stood, and it should be
    taken out of the world rather than built into it. What it actually fitted
    was the diagonal of the Alpilles: on the Reaper the score kept climbing to
    the edge of the search and moved the horizon 16% of the canvas up, onto the
    hills, because a tilted cut can follow a mountain and a level one cannot.
    A knob that a mountain can turn is not measuring the easel. The horizon is
    taken level.
    """
    v, w = f["v"], f["arc"]
    lab = f["lab"] / np.maximum(f["lab"].std(0), EPS)     # per channel, scale free
    rng = np.random.default_rng(seed)
    perms = [rng.permutation(len(v)) for _ in range(SHUF)]

    def best(proj, lo, hi):
        offs = np.arange(lo, hi + 1e-9, VSTEP)
        sc, o = _scan(proj, lab, w, offs)
        k = int(np.argmax(sc))
        ps, ws = proj[o], w[o]                  # the null re-uses the sort
        cw = np.r_[0.0, np.cumsum(ws)]
        i = np.searchsorted(ps, offs)
        w1, w2 = cw[i], cw[-1] - cw[i]
        live = (w1 > EPS) & (w2 > EPS)
        nul = np.empty(len(perms))
        for j, p in enumerate(perms):
            cl = np.vstack([np.zeros(3), np.cumsum(lab[p][o] * ws[:, None], 0)])
            m1 = cl[i] / np.maximum(w1, EPS)[:, None]
            m2 = (cl[-1] - cl[i]) / np.maximum(w2, EPS)[:, None]
            nul[j] = np.where(live, w1 * w2 / max(cw[-1], EPS) ** 2
                              * ((m1 - m2) ** 2).sum(1), 0.0).max()
        return float(offs[k]), float(sc[k]), float(np.percentile(nul, 95))

    vh, sc, nul = best(v, VLO, VHI)
    _, col, _ = best(f["u"] * aspect, 0.05 * aspect, 0.95 * aspect)
    return dict(v=float(vh), score=sc, null95=nul, column=col,
                ratio=float(sc / max(col, EPS)))


# --------------------------------------------------------- the size gradient --

def _binned(v, size, n=NBIN):
    """Equal-count bins, median inside each. Medians because the subject stands
    on the ground and does not obey it: a reaper, a cart and three sheaves are
    a minority of large marks at one height, and a mean would follow them."""
    o = np.argsort(v, kind="stable")
    cut = np.array_split(o, n)
    return (np.array([np.median(v[c]) for c in cut if len(c)]),
            np.array([np.median(size[c]) for c in cut if len(c)]),
            np.array([len(c) for c in cut if len(c)]))


def _lsq(x, y):
    A = np.c_[x, np.ones_like(x)]
    (b, a), *_ = np.linalg.lstsq(A, y, rcond=None)
    r = y - (a + b * x)
    ss = ((y - y.mean()) ** 2).sum()
    return float(b), float(a), float(1.0 - (r ** 2).sum() / max(ss, EPS))


def size_gradient(f, vh, seed=SEED):
    """Fit size against height on the canvas, twice: below the horizon and above.

    The sky fit is the control, and it is the one that would show this
    measuring the composition rather than a plane: a dome has no texture
    gradient, so a sky that slopes as hard as the ground means the canvas
    simply has bigger marks at the bottom for reasons that have nothing to do
    with distance.
    """
    k = f["keep"]
    out = {}
    for name, m in (("ground", k & (f["v"] > vh)), ("sky", k & (f["v"] <= vh))):
        if m.sum() < 4 * NBIN:
            out[name] = None
            continue
        r = {}
        for what, size in (("wid", f["wid"][m]), ("arc", f["arc"][m])):
            x, y, cnt = _binned(f["v"][m], size)
            b, a, r2 = _lsq(x, y)
            r[what] = dict(slope=b, intercept=a, r2=r2, bins=(x, y, cnt))
        out[name] = r
    # the null the slope has to beat: the same fit with the heights permuted
    m = k & (f["v"] > vh)
    rng = np.random.default_rng(seed)
    vv = f["v"][m].copy()
    null = np.empty(SHUF_V)
    for j in range(SHUF_V):
        x, y, _ = _binned(rng.permutation(vv), f["wid"][m])
        null[j] = _lsq(x, y)[0]
    real = out["ground"]["wid"]["slope"]
    out["null"] = dict(p=float((null <= real).mean()),
                       lo=float(np.percentile(null, 1)), hi=float(np.percentile(null, 99)))
    return out


def gamma_fit(f, vh, what="wid", seed=SEED, nboot=400):
    """size ~ (v - vh)^gamma, in logs. gamma = 1 is a perspective plane."""
    m = f["keep"] & (f["v"] > vh + GUARD)
    if m.sum() < 4 * NBIN:
        return None
    q = np.log(f["v"][m] - vh)
    s = np.log(np.maximum(f[what][m], EPS))
    x, y, cnt = _binned(q, s)
    g, a, r2 = _lsq(x, y)
    rng = np.random.default_rng(seed)
    bs = np.empty(nboot)
    idx = np.flatnonzero(m)
    for j in range(nboot):
        p = rng.integers(0, len(idx), len(idx))
        bx, by, _ = _binned(q[p], s[p])
        bs[j] = _lsq(bx, by)[0]
    return dict(gamma=g, r2=r2, n=int(m.sum()),
                lo=float(np.percentile(bs, 2.5)), hi=float(np.percentile(bs, 97.5)),
                bins=(x, y, cnt))


def clipped(f, p, vh):
    """How much of the far field is sitting on the parameter floor.

    Clipping can only flatten the gradient, so this is the number that turns a
    measured gamma into a lower bound. Quoted for the far half of the ground,
    which is where the floor is reached and the only place it matters.
    """
    short = min(f["cw"], f["ch"])
    wpx = f["wid"] * short
    m = f["keep"] & (f["v"] > vh)
    if not m.any():
        return dict(wid=0.0, arc=0.0)
    far = m & (f["v"] < vh + 0.5 * (f["v"][m].max() - vh))
    tol = 1.02
    return dict(wid=float((wpx[far] <= p["width_min"] * tol).mean()),
                arc=float((f["arc"][far] <= p["min_arc"] * tol).mean()),
                n=int(far.sum()))


# ------------------------------------------------------- the vanishing point --

def vanishing(f, vh, aspect, seed=SEED):
    """Do the strokes themselves point at the horizon that colour found?

    The size of a mark turns out to say nothing about distance (see place()),
    so this is the other place evidence for a plane could live: not in the
    touch but in the drawing. Parallel lines on the ground -- a furrow, a
    fence, the edge of a cut field, a road -- converge, and where they converge
    is *on* the horizon. So extend every long ground stroke to the row the
    colour split found and ask where it crosses. Strokes that point nowhere in
    particular scatter their crossings across the canvas and beyond it;
    a family of parallels piles them up.

    The control shuffles the directions between strokes and keeps the
    midpoints, which leaves the crossings' spread alone and destroys only the
    fan. Near-level strokes are refused because their crossing runs off to
    infinity and one of them would carry the whole estimate.
    """
    rng = np.random.default_rng(seed)
    m = f["keep"] & (f["v"] > vh + GUARD)
    if m.sum() < 200:
        return None
    long = f["arc"][m] >= np.percentile(f["arc"][m], 75)
    P, mid = f["P"][m][long], f["mid"][m][long]
    w = f["arc"][m][long]
    d = P[:, 2] - P[:, 0]
    d /= np.maximum(np.hypot(d[:, 0], d[:, 1]), EPS)[:, None]
    steep = np.abs(d[:, 1]) > math.sin(math.radians(15.0))
    d, mid, w = d[steep], mid[steep], w[steep]
    if len(d) < 100:
        return None
    grid = np.arange(-1.0, 2.0, 0.01)

    def peak(dirs):
        x = (mid[:, 0] + dirs[:, 0] * (vh - mid[:, 1]) / dirs[:, 1]) * aspect
        k = np.exp(-0.5 * ((grid[:, None] - x[None]) / 0.05) ** 2) * w[None]
        return float(k.sum(1).max() / max(w.sum(), EPS))

    real = peak(d)
    null = np.array([peak(d[rng.permutation(len(d))]) for _ in range(24)])
    return dict(peak=real, null=float(np.median(null)), n=int(len(d)),
                over=int((null < real).sum()), trials=len(null),
                ratio=float(real / max(np.median(null), EPS)))


# ------------------------------------------------------------- into the world --

def lift(u, v, vh, gamma, aspect, hfov=HFOV, eye=EYE, dome=DOME):
    """Canvas to world, at the standpoint, in metres.

    The canvas is a window and a point on it is a ray. Every stroke stays on
    its own ray -- which is what makes the first exit criterion of M3 true by
    construction rather than by tuning: from the painter's position the lifted
    world *is* the painting, for any gamma, because gamma only says how far
    along the ray a stroke sits and never which ray it is on.

    Above the horizon the ray runs to the dome. Below it, a perspective plane
    would put the stroke at eye*rho/(v - vh); this canvas says
    (v - vh)^-gamma, normalised at the bottom edge so the near paint lands
    where a plane would have put it anyway. So gamma bends the surface the
    ground strokes lie on: at 1 it is flat, and as it falls the far field
    stands up, until at 0 the whole thing is a wall at one distance with the
    horizon painted on it.

    Nothing here is a free constant. The scale of the world is the eye height
    of DESIGN 6 -- 1.65 m -- and the measured horizon: standing that tall in
    front of that line puts the bottom edge of the canvas where it puts it.

    The runtime's vertex shader does exactly this, and the two are kept in
    step the way M1 kept the chunk boxes in step with the ribbons: side by
    side, in the same words, so a change to one that is not a change to the
    other shows up as a disagreement rather than as bad art.
    """
    fz = (aspect / 2) / math.tan(math.radians(hfov) / 2)
    x = (np.asarray(u, np.float64) - 0.5) * aspect
    y = vh - np.asarray(v, np.float64)                  # + above the horizon
    rho = np.hypot(x, fz)
    q = np.maximum(-y, EPS)                             # depth below the horizon
    d = np.minimum(eye * rho / (1.0 - vh) * ((1.0 - vh) / q) ** gamma, dome)
    t = np.where(y >= 0, dome / np.sqrt(x * x + y * y + fz * fz), d / rho)
    return np.stack([t * x, eye + t * y, -t * fz], -1)


def surface(f, vh, gamma, aspect, hfov=HFOV, eye=EYE):
    """What the ground strokes actually lie on once they are lifted.

    gamma is an exponent until you ask where it puts the paint, and then it is
    a shape. A plain that reaches the horizon at eye height is not a plain, it
    is a wall, and the honest thing is to measure the surface rather than to
    read the exponent and hope. Reported as how high the far field ends up and
    how far out it gets, both in metres.
    """
    m = f["keep"] & (f["v"] > vh + GUARD)
    if m.sum() < 200:
        return None
    W = lift(f["u"][m], f["v"][m], vh, gamma, aspect, hfov, eye)
    d = np.hypot(W[:, 0], W[:, 2])
    far = f["v"][m] < vh + 0.25 * (f["v"][m].max() - vh)     # the far quarter
    return dict(rise=float(np.median(W[far, 1])), reach=float(np.median(d[far])),
                near=float(np.median(d[~far])), dmax=float(np.percentile(d, 99)))


def density_bound(f, vh, gamma, aspect, hfov=HFOV, frac=DENS_FRAC, eye=EYE):
    """How far into the plain the paint holds out, in metres.

    A lifted ground is one canvas row per annulus, so the same strokes cover
    more and more ground as you walk out and the field visibly thins. This is
    the honest far bound for the viewing volume: past it there is nothing left
    to look at, and a viewer who gets there has found the edge of the
    construction rather than the edge of a rule.
    """
    m = f["keep"] & (f["v"] > vh + GUARD)
    if m.sum() < 200:
        return None
    W = lift(f["u"][m], f["v"][m], vh, gamma, aspect, hfov, eye, dome=1e9)
    d = np.hypot(W[:, 0], W[:, 2])
    edges = np.exp(np.linspace(math.log(max(d.min(), 0.5)), math.log(400.0), 26))
    cnt, _ = np.histogram(d, edges)
    rho = cnt / (math.radians(hfov) / 2 * (edges[1:] ** 2 - edges[:-1] ** 2))
    ref = float(rho[:3].max())
    out = float(edges[-1])
    for i in range(len(rho)):
        if edges[i] > edges[0] * 1.5 and rho[i] < frac * ref:
            out = float(edges[i])
            break
    return dict(d=out, ref=ref)


# ------------------------------------------------------------------- the run --

def place(doc, p, audit=False):
    """Measure, then let the measurement pick the treatment.

    Pre-registered before any canvas was run, because a threshold chosen after
    seeing the numbers is not a threshold:

      the level split must beat the upright one by 2x   -> there is a horizon,
        and the canvas is lifted. Every picture has a strongest colour boundary,
        including a face; a horizon is one that is *horizontal*, and the ratio
        between the best near-level cut and the best upright cut is what says
        so. The self-portrait of station 2 is run through the same code as the
        negative control, and it is the only reason to believe the number.

      the size gradient must beat its shuffled null     -> the canvas carries a
        foreshortening cue, and gamma is the recession law the ground is built
        with. This is the test that could have given the plane its exponent
        from the paint. It did not, and what it returned instead is in BUILD.md
        M3: mark size on these canvases is flat to about 7% across the whole
        depth of the picture and what drift there is runs the wrong way, where
        a perspective plane over the same depth demands a factor of thirteen.
        So the exponent is not fitted. The ground is built at gamma = 1, which
        is what a plane *is*, and the piece says that the horizon is evidence
        and the plane is construction.
    """
    f = features(doc)
    cw, ch = doc["canvas_px"]
    f["cw"], f["ch"] = cw, ch
    aspect = doc["canvas_cm"][0] / doc["canvas_cm"][1]
    t = time.time()

    hc = horizon_colour(f, aspect)
    vh = hc["v"]
    sg = size_gradient(f, vh)
    gw = gamma_fit(f, vh, "wid")
    ga = gamma_fit(f, vh, "arc")
    cl = clipped(f, p, vh)
    vp = vanishing(f, vh, aspect)

    g = sg["ground"]["wid"] if sg["ground"] else None
    sk = sg["sky"]["wid"] if sg["sky"] else None
    lifted = bool(hc["ratio"] >= HORIZON_RATIO and g)
    # the gradient "fires" only if it beats the null *in the direction a plane
    # would need*. A significant gradient pointing the other way is not weak
    # evidence for a plane, it is evidence against one.
    fired = bool(g and sg["null"]["p"] >= 0.99 and g["slope"] > 0)
    gmeas = float(gw["gamma"]) if gw else 0.0
    gamma = gmeas if fired and gmeas >= GAMMA_LIFT else 1.0
    # near over far, over the band the fit actually used. A plane's answer is
    # the ratio of the two depths; the paint's answer is the ratio of the two
    # median widths. No extrapolation on either side, so they are comparable.
    if g:
        bx, by, _ = g["bins"]
        demand = float((bx[-1] - vh) / max(bx[0] - vh, EPS))
        got = float(by[-1] / max(by[0], EPS))
    else:
        demand = got = 0.0

    sf = surface(f, vh, gamma, aspect)
    db = density_bound(f, vh, gamma, aspect)
    n = len(f["v"])
    sky = int((f["v"] <= vh).sum())

    rep = dict(
        treatment="lifted" if lifted else "present",
        horizon=vh,
        split=float(hc["score"]), split_null=float(hc["null95"]),
        column=float(hc["column"]), horizon_ratio=float(hc["ratio"]),
        gradient=fired, gamma=float(gamma), gamma_measured=gmeas,
        gamma_lo=float(gw["lo"]) if gw else 0.0,
        gamma_hi=float(gw["hi"]) if gw else 0.0,
        gamma_r2=float(gw["r2"]) if gw else 0.0,
        gamma_arc=float(ga["gamma"]) if ga else 0.0,
        slope=float(g["slope"]) if g else 0.0, slope_r2=float(g["r2"]) if g else 0.0,
        sky_slope=float(sk["slope"]) if sk else 0.0,
        sky_r2=float(sk["r2"]) if sk else 0.0, null_p=float(sg["null"]["p"]),
        size_ratio=got, size_demand=float(demand),
        clip_wid=float(cl["wid"]), clip_arc=float(cl["arc"]),
        vp_peak=float(vp["peak"]) if vp else 0.0,
        vp_null=float(vp["null"]) if vp else 0.0,
        vp_ratio=float(vp["ratio"]) if vp else 0.0, vp_n=int(vp["n"]) if vp else 0,
        vp_over=int(vp["over"]) if vp else 0, vp_trials=int(vp["trials"]) if vp else 0,
        rise=float(sf["rise"]) if sf else 0.0, reach=float(sf["reach"]) if sf else 0.0,
        near=float(sf["near"]) if sf else 0.0, dmax=float(sf["dmax"]) if sf else 0.0,
        far=float(db["d"]) if db else 0.0,
        hfov=HFOV, eye=EYE, dome=DOME,
        sky_strokes=sky, ground_strokes=n - sky, secs=round(time.time() - t, 1))

    print(f"{doc['slug']}/{doc['tile']}: {n} strokes, {aspect:.3f} aspect")
    print(f"  a horizon?          the best level cut scores {hc['score']:.3f},"
          f" the best upright one {hc['column']:.3f}"
          f"   {hc['ratio']:.1f}x   (>= {HORIZON_RATIO} is a horizon)")
    print(f"  where               v = {vh:.3f}"
          f"   against {hc['null95']:.4f} with the colours shuffled"
          f"  ({hc['score']/max(hc['null95'],EPS):.0f}x)")
    if g:
        bx, by, _ = g["bins"]
        print(f"  does size recede?   the far bin is {by[0]*min(cw,ch):.0f} px wide"
              f" and the near one {by[-1]*min(cw,ch):.0f} px"
              f"   x{got:.2f}, where a plane over that depth demands x{demand:.1f}")
        print(f"    the shuffled null percentile {sg['null']['p']*100:.2f}"
              f"   {'a real gradient, and it runs the wrong way' if g['slope'] < 0 and sg['null']['p'] <= 0.01 else 'fires' if fired else 'nothing'}"
              + (f"   the sky control {-sk['slope']*1000:+.2f} vs the ground's"
                 f" {-g['slope']*1000:+.2f} thousandths" if sk else ""))
    if gw:
        print(f"    gamma if fitted   {gw['gamma']:+.2f}"
              f"  [{gw['lo']:+.2f}, {gw['hi']:+.2f}]  R2 {gw['r2']:.2f}"
              f"   by arc {ga['gamma']:+.2f}"
              f"   floor-clipped {cl['wid']*100:.0f}% / {cl['arc']*100:.0f}%")
    if vp:
        print(f"  do the marks point? {vp['n']} long ground strokes cross the horizon"
              f"   peak {vp['peak']:.3f} against {vp['null']:.3f} shuffled"
              f"  ({vp['ratio']:.2f}x, above {vp['over']} of {vp['trials']})")
    print(f"  sky / ground        {sky} / {n - sky} strokes")
    if sf and lifted:
        print(f"  the lifted ground   near paint {sf['near']:.1f} m out,"
              f" far paint {sf['reach']:.0f} m out"
              f"   the plain runs to {sf['dmax']:.0f} m"
              f"   built at gamma {gamma:.2f}")
    if db and lifted:
        print(f"  the plain thins     {db['d']:.0f} m out"
              f"   (a quarter of the paint left a square metre)")
    print(f"  ==> {rep['treatment'].upper()}"
          f"   {'a plain: the horizon is measured, the plane is construction' if lifted else 'a wall of paint: no horizon on this canvas'}"
          f"   {time.time()-t:.0f}s")
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("--audit", action="store_true", help="measure, write nothing")
    a = ap.parse_args()
    doc = json.load(open(a.json))
    p = json.load(open(os.path.join(ROOT, "params", doc["slug"] + ".json")))
    rep = place(doc, p, a.audit)
    if a.audit:
        print("  --audit: nothing written")
        return
    doc["place"] = rep
    json.dump(doc, open(a.json, "w"))
    print(f"  wrote place into {os.path.relpath(a.json, ROOT)}")


if __name__ == "__main__":
    main()
