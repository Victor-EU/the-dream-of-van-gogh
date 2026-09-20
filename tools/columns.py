#!/usr/bin/env python3
"""His columns on the water (DESIGN 5.2), measured, so that ours can be laid under our own lights.

Rule 3 of the build: no generator of ours exists except from a hand measured here. Our reflections are drawn from
the only place in the four canvases where the law of a reflection is written down -- the Rhone's water, where every
gaslight on the far quay throws a column of marks down the river. This is the one time a hand is measured before
its canvas is in the air: the Rhone is exploded in D4, and D3 needs its columns now.

The Rhone's standpoint is D4's to author, so nothing here is stored as a size. A column is measured against
itself: how far it reaches below his waterline (the one number that sets a column's length), how wide it is for
that reach, how long and how wide and how slanted its marks are for that width, how many of them there are, and
what colour they are at each point down it. All of it is a ratio, and a ratio is the same from any standpoint.

    tools/columns.py rhone

What it finds, and what it does not. His ten columns all reach the same depth below his waterline and stop there,
whatever lamp is over them: 0.215 of his canvas height, with a spread of six per cent across the ten. That is what
a reflection does -- the near end of a glitter path is set by how much the water tilts and by how high the eye is,
not by the lamp -- and it is the number src/water.js turns into the water's slope. What his canvas cannot say is
whether they stop there or only run out of river: his near bank begins at 0.70 and his columns end at 0.69. The
log says so. What his canvas does say, and the plan did not expect, is that the length of a column is NOT set by
its lamp's height or its brightness. Both correlations are reported here with their n, which is ten.
"""
import argparse, json, math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from depth import read_record

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QS = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]

# A person's, typed from the canvas, as tools/mask.py types its polylines (DESIGN 4.3). The far bank's edge,
# where his water begins, and the near bank's, where it ends. Nothing else about the Rhone is authored here.
WATERLINE = [[0.0, 0.483], [0.25, 0.479], [0.5, 0.476], [0.75, 0.472], [1.0, 0.470]]
NEAR_BANK = [[0.0, 0.735], [0.3, 0.720], [0.5, 0.702], [0.7, 0.700], [1.0, 0.722]]
# the ten columns, as bands of u: typed from where his lit paint gathers under the quay (the tool prints the
# grouping it would make on its own, and these are that grouping with the two that touch at 0.68 cut apart)
BANDS = [[0.130, 0.200], [0.240, 0.310], [0.335, 0.420], [0.435, 0.495], [0.515, 0.605],
         [0.615, 0.680], [0.680, 0.740], [0.870, 0.915], [0.925, 0.965], [0.970, 1.000]]


def qs(a, k=5):
    a = np.asarray(a, float)
    if a.size == 0: return [0.0] * len(QS)
    return [round(float(v), k) for v in np.quantile(a, QS)]


def pearson(a, b):
    a = np.asarray(a, float); b = np.asarray(b, float)
    if a.size < 3: return None
    sa, sb = a.std(), b.std()
    return round(float(((a - a.mean()) * (b - b.mean())).mean() / (sa * sb)), 3) if sa > 0 and sb > 0 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug', nargs='?', default='rhone')
    ap.add_argument('--hfov', type=float, default=50.0, help="the Rhone's field of view, as BUILD.md plans it; D4 sweeps it")
    ap.add_argument('--bins', type=int, default=8)
    a = ap.parse_args()
    R = read_record(os.path.join(ROOT, 'strokes', a.slug + '-canvas.bin'))
    p = R['p']
    H = R['cm'][1] / 100.0; W = H * R['px'][0] / R['px'][1]; short = min(W, H)
    f = (W / 2) / math.tan(math.radians(a.hfov) / 2)
    u = 0.25 * p[:, 0, 0] + 0.5 * p[:, 1, 0] + 0.25 * p[:, 2, 0]
    v = 0.25 * p[:, 0, 1] + 0.5 * p[:, 1, 1] + 0.25 * p[:, 2, 1]
    rgb = R['rgb'] ** 2.2                                            # linear, as records.js reads it
    lum = 0.2126 * rgb[:, 0] + 0.7152 * rgb[:, 1] + 0.0722 * rgb[:, 2]
    yellow = (rgb[:, 0] + rgb[:, 1]) * 0.5 - rgb[:, 2]
    X = (p[:, :, 0] - 0.5) * W; Y = (0.5 - p[:, :, 1]) * H
    chord = np.hypot(X[:, 2] - X[:, 0], Y[:, 2] - Y[:, 0])
    # how far a mark lies off the horizontal, which on his water is off the way the column runs
    ang = np.degrees(np.arctan2(np.abs(Y[:, 2] - Y[:, 0]), np.abs(X[:, 2] - X[:, 0]) + 1e-12))
    wid = R['w'] * short
    lit = np.clip(yellow, 0, None) * np.clip(lum - 0.03, 0, None) * wid * chord   # lit paint: bright, yellow, and big
    wl = np.interp(u, [q[0] for q in WATERLINE], [q[1] for q in WATERLINE])
    nb = np.interp(u, [q[0] for q in NEAR_BANK], [q[1] for q in NEAR_BANK])
    water = (v > wl) & (v < nb)
    print(f'{a.slug}: {R["n"]} strokes, canvas {100*W:.1f} x {100*H:.1f} cm; his water holds {int(water.sum())}')

    # ---- the columns, one band at a time ----------------------------------------------------------------------
    cols, inband = [], np.zeros(len(u), bool)
    for u0, u1 in BANDS:
        m = (u >= u0) & (u < u1) & water
        inband |= (u >= u0) & (u < u1)
        s = v[m] - wl[m]; w = lit[m]; uu = u[m]
        o = np.argsort(s); c = np.cumsum(w[o]) / max(w.sum(), 1e-12)
        q = lambda t: float(np.interp(t, c, s[o]))
        mu = float((uu * w).sum() / max(w.sum(), 1e-12))
        sd = float(np.sqrt((((uu - mu) ** 2) * w).sum() / max(w.sum(), 1e-12)))
        # the lamp over it: the lit paint of the quay within a canvas tenth above his waterline
        ml = (u >= u0 - 0.02) & (u < u1 + 0.02) & (v < wl) & (v > wl - 0.09)
        wlam = lit[ml]
        lamp = dict(u=round(float((u[ml] * wlam).sum() / max(wlam.sum(), 1e-12)), 4),
                    height=round(float(((wl[ml] - v[ml]) * wlam).sum() / max(wlam.sum(), 1e-12)), 4),
                    lum=round(float((lum[ml] * wlam).sum() / max(wlam.sum(), 1e-12)), 4),
                    paint=round(float(wlam.sum()) * 1e4, 4), n=int(ml.sum()),
                    rgb=[round(float((rgb[ml, k] * wlam).sum() / max(wlam.sum(), 1e-12)), 5) for k in range(3)])
        avail = float(np.mean(nb[m] - wl[m]))
        cols.append(dict(u=[u0, u1], lamp=lamp, reach=round(q(0.95), 4), top=round(q(0.05), 4),
                         mid=round(q(0.5), 4), width=round(2 * sd, 4), paint=round(float(w.sum()) * 1e4, 4),
                         water=round(avail, 4), of_water=round(q(0.95) / avail, 3),
                         n=int(((yellow[m] > 0.02) & (lum[m] > 0.06)).sum())))
    reach = np.array([c['reach'] for c in cols])
    REACH = float(reach.mean())
    print(f'his ten columns reach {REACH:.4f} of the canvas height below his waterline, sd {reach.std():.4f} '
          f'({100*reach.std()/REACH:.0f}%), range {reach.min():.3f}-{reach.max():.3f}')
    for c in cols:
        print(f"  u {c['u'][0]:.3f}-{c['u'][1]:.3f}  top {c['top']:.3f} reach {c['reach']:.3f} "
              f"width {c['width']:.4f}  {c['n']:3d} marks   lamp h {c['lamp']['height']:.4f} lum {c['lamp']['lum']:.3f}")
    vs = dict(n=len(cols),
              reach_vs_lamp_height=pearson(reach, [c['lamp']['height'] for c in cols]),
              reach_vs_lamp_lum=pearson(reach, [c['lamp']['lum'] for c in cols]),
              paint_vs_lamp_lum=pearson([c['paint'] for c in cols], [c['lamp']['lum'] for c in cols]),
              paint_vs_lamp_paint=pearson([c['paint'] for c in cols], [c['lamp']['paint'] for c in cols]))
    vs['top_vs_lamp_height'] = pearson([c['top'] for c in cols], [c['lamp']['height'] for c in cols])
    ofw = float(np.mean([c['of_water'] for c in cols]))
    print('  against the lamp over it: reach/height r =', vs['reach_vs_lamp_height'],
          ' reach/brightness r =', vs['reach_vs_lamp_lum'], ' paint/brightness r =', vs['paint_vs_lamp_lum'])
    print(f'  and each reaches {ofw:.2f} of the water there is under it, so his canvas gives a floor and not a length')

    # the reach as an angle, and the water's slope it implies: the near end of a glitter path is where the water
    # must tilt more than it does to send the lamp to the eye, and for an eye near the water that angle is 2*slope
    yb = REACH * H                                       # the reach, in metres down his canvas from the waterline
    v0 = (0.5 - float(np.mean([q[1] for q in WATERLINE]))) * H
    reach_deg = math.degrees(math.atan2(v0 - yb, f) * -1 + math.atan2(v0, f))
    slope_deg = 0.5 * abs(reach_deg)
    print(f'  which at the {a.hfov:.0f} degree field of view BUILD.md plans for the Rhone is {abs(reach_deg):.2f} '
          f'degrees, so the water tilts {slope_deg:.2f} degrees')

    # ---- what a column is made of ------------------------------------------------------------------------------
    isCol = inband & water & (yellow > 0.02) & (lum > 0.06)
    tau = np.clip((v - wl) / REACH, 0, 1)
    Wm = float(np.mean([c['width'] for c in cols])) * W   # the mean column's width, in metres
    Lm = REACH * H
    nper = float(np.mean([c['n'] for c in cols]))
    print(f'a column is {Lm*100:.1f} cm long and {Wm*100:.1f} cm wide -- {Lm/Wm:.1f} times longer than wide -- '
          f'and holds {nper:.0f} marks')
    mark = dict(n_per_column=round(nper, 1), per_width=round(nper * Wm / Lm, 2),
                len_over_width=qs(chord[isCol] / Wm), wid_over_width=qs(wid[isCol] / Wm),
                ang_deg=qs(ang[isCol], 3), h_mm=qs(R['h'][isCol] * R['height_mm'], 4),
                curl_over_width=qs(R['curl'][isCol] * short / Wm), n=int(isCol.sum()))
    print('  a mark is %.2f of the column wide across and %.2f long, and lies %.0f degrees off the way it runs'
          % (mark['wid_over_width'][3], mark['len_over_width'][3], mark['ang_deg'][3]))

    # the profiles down a column: how wide it is, and how much lit paint it carries, against where you are on it.
    # The width is taken in each column and then averaged over the ten, because the spread of ten columns across
    # his canvas is not the width of one
    edges = np.linspace(0, 1, a.bins + 1)
    wp, sp, cb = [], [], []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = inband & water & (tau >= lo) & (tau < hi + (1e-6 if hi == 1 else 0))
        w = lit[m]
        if w.sum() < 1e-9: wp.append(1.0); sp.append(0.0); cb.append(None); continue
        each = []
        for (u0, u1), c in zip(BANDS, cols):
            k = m & (u >= u0) & (u < u1)
            if lit[k].sum() < 1e-10 or k.sum() < 3: continue
            mu = (u[k] * lit[k]).sum() / lit[k].sum()
            each.append(2 * np.sqrt((((u[k] - mu) ** 2) * lit[k]).sum() / lit[k].sum()) / c['width'])
        wp.append(round(float(np.mean(each)) if each else 1.0, 4))
        sp.append(round(float(w.sum()) * 1e4, 4))
        mc = m & (yellow > 0.02) & (lum > 0.06)
        cb.append(dict(rgb=[round(float(x), 5) for x in rgb[mc].mean(0)],
                       sd=[round(float(x), 5) for x in rgb[mc].std(0)],
                       lum=round(float(lum[mc].mean()), 5), n=int(mc.sum())) if mc.sum() >= 8 else None)
    sp = [round(x / max(sp), 4) for x in sp]
    print('  its width down it:   ', wp)
    print('  its paint down it:   ', sp)
    print('  its colour down it, red gold to green bronze (letter 691):')
    for k, c in enumerate(cb):
        if c: print(f'    {edges[k]:.2f}-{edges[k+1]:.2f}  rgb {c["rgb"]}  lum {c["lum"]:.4f}  '
                    f'R/G {c["rgb"][0]/c["rgb"][1]:.3f}  B/G {c["rgb"][2]/c["rgb"][1]:.3f}  n {c["n"]}')

    # ---- his water itself, which is his sky, darkened ------------------------------------------------------------
    isWat = water & (~inband) & (yellow < 0.02)
    sky = v < 0.36
    wrgb = rgb[isWat].mean(0); srgb = rgb[sky].mean(0)
    print(f'his water between the columns is [{wrgb[0]:.4f} {wrgb[1]:.4f} {wrgb[2]:.4f}] and his sky is '
          f'[{srgb[0]:.4f} {srgb[1]:.4f} {srgb[2]:.4f}]: the water is the sky times '
          f'[{wrgb[0]/srgb[0]:.3f} {wrgb[1]/srgb[1]:.3f} {wrgb[2]/srgb[2]:.3f}]')
    out = dict(
        _='His reflection columns on the Rhone, measured (DESIGN 5.2, BUILD.md D3). Everything is a ratio: a '
          'column against its own reach, a mark against its column, the water against the sky. Nothing here is a '
          'size, because the Rhone has no standpoint until D4.',
        canvas=dict(slug=a.slug, W=round(W, 4), H=round(H, 4), hfov_planned=a.hfov, f=round(f, 4), n=R['n']),
        authored=dict(waterline=WATERLINE, near_bank=NEAR_BANK, bands=BANDS,
                      note='typed from the canvas, as tools/mask.py types its polylines'),
        columns=cols,
        reach=dict(mean=round(REACH, 5), sd=round(float(reach.std()), 5), n=len(cols), of_water=round(ofw, 4),
                   min=round(float(reach.min()), 4), max=round(float(reach.max()), 4),
                   deg_at_planned_hfov=round(abs(reach_deg), 3), slope_deg=round(slope_deg, 3),
                   near_bank_at=round(float(np.mean([q[1] for q in NEAR_BANK])) - float(np.mean([q[1] for q in WATERLINE])), 4),
                   vs_lamp=vs),
        lamp=dict(rgb=[round(float(np.mean([c['lamp']['rgb'][k] for c in cols])), 5) for k in range(3)],
                  lum=round(float(np.mean([c['lamp']['lum'] for c in cols])), 5),
                  note='his gaslights, as the paint on the quay above each column: what a column of ours is '
                       'tinted against, so that a light his colour throws his column'),
        shape=dict(width_over_reach=round(Wm / Lm, 5), long_over_wide=round(Lm / Wm, 3),
                   width_profile=wp, paint_profile=sp),
        mark=mark,
        colour=dict(bins=cb, edges=[round(float(x), 4) for x in edges]),
        water=dict(rgb=[round(float(x), 5) for x in wrgb], sky_rgb=[round(float(x), 5) for x in srgb],
                   over_sky=[round(float(wrgb[k] / srgb[k]), 4) for k in range(3)],
                   lum=round(float(lum[isWat].mean()), 5), sky_lum=round(float(lum[sky].mean()), 5),
                   n=int(isWat.sum()), sky_n=int(sky.sum()),
                   chord_over_short=qs(chord[isWat] / short), wid_over_short=qs(wid[isWat] / short),
                   ang_deg=qs(ang[isWat], 3), h_mm=qs(R['h'][isWat] * R['height_mm'], 4)))
    dest = os.path.join(ROOT, 'hand', a.slug + '-column.json')
    json.dump(out, open(dest, 'w'), indent=1)
    print('wrote', dest)


if __name__ == '__main__' and '--check' not in sys.argv:
    main()


def check():
    """D3's law, against the canvas it was drawn from, now that the canvas has a standpoint (BUILD.md D4).

    D3 had no standpoint for the Rhone, so its law -- a column runs from the far point where the water would have
    to tilt +2 sigma to send the light to the eye to the near point where it would tilt -2 sigma -- could only be
    checked by rendering it. D4 gives the Rhone an eye, so the law can be asked the one question that matters:
    put his own eye and his own lamps into it, and does it put the column where he painted it?

        tools/columns.py rhone --check
    """
    slug = sys.argv[1]
    H = json.load(open(os.path.join(ROOT, 'hand', slug + '-column.json')))
    laws = json.load(open(os.path.join(ROOT, 'depth', slug + '.json')))
    eye = laws['eye']
    W, Hc, f = H['canvas']['W'], H['canvas']['H'], H['canvas']['f']
    A = eye['y']
    sig = math.radians(H['reach']['slope_deg'] / 2.0)
    k = math.tan(2 * sig)
    wl = H['authored']['waterline']
    wline = lambda u: np.interp(u, [p[0] for p in wl], [p[1] for p in wl])
    far_bank = laws['regions']['farbank']['law']['d']

    def el_of(v):                                   # elevation of a canvas row, radians
        return math.radians(eye['pitch']) + math.atan(((0.5 - v) * Hc) / f)

    print(f"{slug}: his eye {A:.2f} m over the water, pitched {eye['pitch']:+.2f}, the far bank at {far_bank:.0f} m;"
          f" the water's slope {H['reach']['slope_deg']:.3f} deg")
    print('   lamp      his column, m        the law, m          off')
    rows = []
    for c in H['columns']:
        u = c['lamp']['u']
        vw = float(wline(u))
        elL = el_of(vw - c['lamp']['height'])
        B = A + far_bank * math.sin(elL)            # the lamp's height over the water
        D = far_bank * math.cos(elL)                # and how far off it stands
        vt, vb = vw + c['top'], vw + c['top'] + c['reach']
        xf = A / math.tan(-el_of(vt)); xn = A / math.tan(-el_of(vb))
        b1 = A + B + k * D; c1 = A * D - k * A * B; d1 = b1 * b1 - 4 * k * c1
        ln = (b1 - math.sqrt(d1)) / (2 * k) if d1 > 0 else A * D / (A + B)
        b2 = A + B - k * D; c2 = A * D + k * A * B
        lf = min((-b2 + math.sqrt(max(b2 * b2 + 4 * k * c2, 0.0))) / (2 * k), D * 0.999)
        rows.append((xn, xf, ln, lf, B, D))
        print(f"  u {u:.3f} h {B:5.1f} m  {xn:6.1f} to {xf:6.1f}   {ln:6.1f} to {lf:6.1f}"
              f"   near {100*(ln/xn-1):+6.1f}%  far {100*(lf/xf-1):+6.1f}%")
    # And the other way about: what slope puts his columns where he painted them? D3 read the slope straight off
    # the angular reach -- 8.47 degrees of canvas, so 4.24 of water -- which is only true for a light at infinity.
    # His lamps stand 2 to 7 m over the water at 220 m, and at that distance the same slope opens a path twice as
    # long as the one he painted. With a standpoint the question inverts: solve for the slope, column by column.
    fits = []
    for (xn0, xf0, _l, _L, B, D) in rows:
        best, bs = None, None
        for sd in np.arange(0.2, 30.0, 0.01):
            kk = math.tan(math.radians(sd))
            b1 = A + B + kk * D; c1 = A * D - kk * A * B; d1 = b1 * b1 - 4 * kk * c1
            n1 = (b1 - math.sqrt(d1)) / (2 * kk) if d1 > 0 else A * D / (A + B)
            b2 = A + B - kk * D; c2 = A * D + kk * A * B
            f1 = min((-b2 + math.sqrt(max(b2 * b2 + 4 * kk * c2, 0.0))) / (2 * kk), D * 0.999)
            e = math.log(n1 / xn0) ** 2 + math.log(f1 / xf0) ** 2
            if best is None or e < best: best, bs = e, sd
        fits.append(bs / 2.0)                        # the file keeps the slope as 2 sigma, as D3 did
    fit = float(np.median(fits))
    xn, xf, ln, lf = (np.array([r[i] for r in rows]) for i in range(4))
    print(f"  over the ten: the far end {100*np.median(lf/xf-1):+.1f}% off his (median), "
          f"the near end {100*np.median(ln/xn-1):+.1f}%")
    print(f"  his columns run {np.median(xn):.0f} to {np.median(xf):.0f} m; the law's {np.median(ln):.0f} to {np.median(lf):.0f} m")
    print(f"  the slope that puts them where he painted them: {2*fit:.3f} deg (2 sigma), "
          f"column by column {np.round(2*np.array(fits), 2).tolist()}")
    json.dump({'_': "What his own canvas says about D3's law, once the canvas had a standpoint (BUILD.md D4). "
                    "Nothing here is used by the runtime: it is the record of a law being asked the one question "
                    "that could refute it. Put his eye, his lamps and his far bank into D3's glitter path and it "
                    "opens the column twice as far out as he painted it -- his ten run 22 to 86 m from his eye "
                    "and the law's 47 to 186 -- and no slope mends both ends, because his columns lie entirely "
                    "inside the mirror point (A D / (A + B), about 118 m here) where a specular path must "
                    "straddle it. Solved jointly for pitch, eye height and slope, the best fit runs to the edge "
                    "of the physical range: an eye 7 m up pitched 15.8 degrees down, a bank 26 m off and a water "
                    "tilting 22.5 degrees, which is not a river at Arles and not water. So his reflections are "
                    "drawn the way reflections are drawn, hanging from the light toward the viewer, and the "
                    "specular account of where a column stands is a model his canvas does not carry. D3's slope "
                    "is kept in the runtime because what it gets right is the one thing the piece needs from it "
                    "-- a column of about his angular length that follows the eye -- and this file says what it "
                    "gets wrong.",
               'slug': slug, 'eye': eye, 'far_bank_m': far_bank,
               'slope_deg': round(2 * fit, 4), 'per_column_deg': [round(2 * v, 3) for v in fits],
               'sd_deg': round(float(2 * np.std(fits)), 4), 'n': len(fits),
               'd3_slope_deg': H['reach']['slope_deg'],
               'd3_off_pct': {'near': round(float(100 * np.median(ln / xn - 1)), 1),
                              'far': round(float(100 * np.median(lf / xf - 1)), 1)}},
              open(os.path.join(ROOT, 'hand', slug + '-glitter.json'), 'w'), indent=1)
    json.dump({'_': "D3's law against the canvas it was drawn from, once the canvas had a standpoint (BUILD.md D4).",
               'eye': eye, 'slope_deg': H['reach']['slope_deg'], 'far_bank_m': far_bank,
               'columns': [{'lamp_height_m': round(r[4], 2), 'lamp_dist_m': round(r[5], 1),
                            'his_m': [round(r[0], 1), round(r[1], 1)], 'law_m': [round(r[2], 1), round(r[3], 1)]} for r in rows],
               'far_off_pct': round(float(100 * np.median(lf / xf - 1)), 1),
               'near_off_pct': round(float(100 * np.median(ln / xn - 1)), 1)},
              open(os.path.join(ROOT, 'shots', slug + '-glitter.json'), 'w'), indent=1)


if __name__ == '__main__' and '--check' in sys.argv:
    check()
