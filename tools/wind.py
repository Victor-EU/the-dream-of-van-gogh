#!/usr/bin/env python3
"""The wind, fitted (DESIGN 3.2, 4.7). The flow his sky strokes lie along is the air you fly in.

A velocity field on the canvas plane -- a drift, a wave, and a few vortices -- is fitted to the tangents of the
sky strokes of a record, by the angle between the field and each stroke's chord. The strokes are lines, not
arrows: the pipeline traces a stroke from its top point down, whichever way he pulled it, so the fit is to the
tangent line and cannot know which way the wind blows. One sign is authored, that the drift blows from the left
of the canvas to the right, and given that, the sense of every vortex is the fit's: a vortex that turns with the
drift on one side and against it on the other lays different lines than one turning the other way. Each vortex
also has an in-flow, q, and the pair (turn, in-flow) is only fixed up to a common sign by lines alone; the fit
reports how much the mirrored pair is worse, and if the difference is nothing, the sense is authored and says so.

    drift      a unit vector at angle beta (the field is fitted up to one scale)
    wave       A sin(2 pi (x cos phi + y sin phi) / lambda + psi), perpendicular to (cos phi, sin phi)
    vortex     s g(rho / r) along the circle round (cx, cy), plus q of the same toward the centre, where g is
               either 'gauss', (rho/r) exp((1 - (rho/r)^2) / 2), peak s at rho = r and nothing far away, or
               'oseen', (r/rho)(1 - exp(-(rho/r)^2)), a solid core and a tail that falls as 1/rho, so that the
               eddy still bends the bands far from it; the tool fits both and keeps the better

Two numbers are measured that the fit cannot change. The noise floor: the mean angle between each stroke and the
common orientation of its neighbours within 2.5 cm, which is the scatter of his hand within a band, and the
least any smooth field can leave. And the residual: the mean acute angle between the fitted field and his
tangents over the strokes fitted, unweighted, pre-registered in BUILD.md D1 at <= 15 degrees. The fit weights a
stroke by its chord, up to 3 cm, since a short stroke's chord is a poor tangent. With --vortices above the three
(the two eddies and the moon), each further vortex is seeded where the residual is worst and kept if it helps.

What is flown is the fitted shape at authored speeds: the drift at --drift m/s, the wave with it, and the
vortices together so that the great eddy turns at --peak m/s at its fastest and no eddy turns faster, plus
--draw along each eddy's axis in its core, away from his eye (a lift straight up cannot lift inside a vortex; it
only moves the closed orbits aside, and D1 measured it), and --inflow of the fitted in-flow, which is none by default: DESIGN 4.7 gives a
vortex a turn and a strength, the in-flow is the fit's own term for the spiral of his lines, and flown it is a
sink that a body hangs at. Those speeds change the field's lines where the eddies meet the drift, so the flown
field's residual is measured and logged beside the fit's. Writes hand/<slug>-wind.json (measured and authored parts labelled) and shots/<slug>-wind.png:
the flat, his tangents coloured by their residual (green 0, red 45), and the flown field's streamlines.

    tools/wind.py starry [--vortices 3] [--regions sky,swirl] [--profile oseen|gauss|both]
"""
import argparse, itertools, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import least_squares
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from depth import read_record

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def profile(u, kind):
    if kind == 'gauss': return u * np.exp(0.5 * (1.0 - u * u))
    return (1.0 - np.exp(-u * u)) / np.maximum(u, 1e-6)          # oseen: u at 0, 1/u far; peak 0.64 at 1.12


def field(P, x, y, nv, kind, drift=1.0, vscale=1.0):
    """P: beta, A, phi, loglam, psi, then (cx, cy, logr, s, q) per vortex. drift and vscale are the speeds."""
    beta, A, phi, loglam, psi = P[:5]
    Fx = np.full_like(x, drift * math.cos(beta)); Fy = np.full_like(x, drift * math.sin(beta))
    lam = math.exp(loglam)
    ph = drift * A * np.sin(2 * np.pi * (x * math.cos(phi) + y * math.sin(phi)) / lam + psi)
    Fx += -math.sin(phi) * ph; Fy += math.cos(phi) * ph
    core = np.zeros_like(x)
    for i in range(nv):
        cx, cy, logr, s, q = P[5 + 5 * i:10 + 5 * i]
        r = math.exp(logr)
        dx, dy = x - cx, y - cy
        rho = np.hypot(dx, dy) + 1e-9
        g = vscale * s * profile(rho / r, kind)
        Fx += g * (-dy / rho - q * dx / rho); Fy += g * (dx / rho - q * dy / rho)
        core = np.maximum(core, np.exp(-0.5 * (rho / r) ** 2))
    return Fx, Fy, core


def sin_of(P, x, y, tx, ty, nv, kind, drift=1.0, vscale=1.0):
    Fx, Fy, _ = field(P, x, y, nv, kind, drift, vscale)
    return np.abs(Fx * ty - Fy * tx) / np.sqrt((Fx * Fx + Fy * Fy + 1e-12) * (tx * tx + ty * ty))


def angles(P, x, y, tx, ty, nv, kind, drift=1.0, vscale=1.0):
    return np.degrees(np.arcsin(np.clip(sin_of(P, x, y, tx, ty, nv, kind, drift, vscale), 0, 1)))


def fit(P0, lo, hi, x, y, ux, uy, w, nv, kind):
    sw = np.sqrt(w)
    r = least_squares(lambda P: sw * sin_of(P, x, y, ux, uy, nv, kind), P0, bounds=(lo, hi), method='trf',
                      xtol=1e-6, ftol=1e-8, max_nfev=400)
    return r.x, float(angles(r.x, x, y, ux, uy, nv, kind).mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--vortices', type=int, default=3)
    ap.add_argument('--regions', default='sky,swirl')
    ap.add_argument('--profile', default='both')
    ap.add_argument('--drift', type=float, default=2.0, help='the open wind, m/s (authored; a glide is 3)')
    ap.add_argument('--peak', type=float, default=8.0, help='the great eddy\'s peak speed, m/s (authored)')
    ap.add_argument('--draw', type=float, default=1.0, help='the draw along an eddy\'s axis in its core, away from his eye, m/s (authored)')
    ap.add_argument('--inflow', type=float, default=0.0, help='how much of the fitted in-flow is flown (authored; a flown in-flow is a sink, and a body at a sink hangs)')
    a = ap.parse_args()
    slug = a.slug
    laws = json.load(open(os.path.join(ROOT, 'depth', slug + '.json')))
    R = read_record(os.path.join(ROOT, 'strokes', slug + '-canvas.bin'))
    mask = np.asarray(Image.open(os.path.join(ROOT, 'depth', slug + '-mask.png')).convert('RGB'))
    depth = np.fromfile(os.path.join(ROOT, 'depth', slug + '-depth.bin'), '<f4').reshape(-1, 2)[:, 0]
    n = R['n']; p = R['p']
    H = R['cm'][1] / 100.0; W = H * R['px'][0] / R['px'][1]
    eye = laws['eye']
    f = (W / 2) / math.tan(math.radians(eye['hfov']) / 2)
    # the canvas plane in metres, origin at the centre, x right, y up
    X = (p[:, :, 0] - 0.5) * W; Y = (0.5 - p[:, :, 1]) * H
    mid = np.stack([0.25 * X[:, 0] + 0.5 * X[:, 1] + 0.25 * X[:, 2], 0.25 * Y[:, 0] + 0.5 * Y[:, 1] + 0.25 * Y[:, 2]], 1)
    tx, ty = X[:, 2] - X[:, 0], Y[:, 2] - Y[:, 0]
    chord = np.hypot(tx, ty)
    ux_all, uy_all = tx / (chord + 1e-9), ty / (chord + 1e-9)
    # regions, as depth.py reads them
    mh, mw = mask.shape[:2]
    muv = 0.25 * p[:, 0] + 0.5 * p[:, 1] + 0.25 * p[:, 2]
    px = np.clip((muv[:, 0] * mw).astype(int), 0, mw - 1); py = np.clip((muv[:, 1] * mh).astype(int), 0, mh - 1)
    col = mask[py, px].astype(int)
    names = list(laws['regions'].keys())
    keys = np.array([laws['regions'][k]['key'] for k in names])
    region = np.argmin(((col[:, None, :] - keys[None, :, :]) ** 2).sum(-1), axis=1)
    rname = np.array(names)[region]
    fit_regions = a.regions.split(',')
    m = np.isin(rname, fit_regions) & (chord > 0.004)
    idx = np.where(m)[0]
    x, y = mid[m, 0], mid[m, 1]; ux, uy = ux_all[m], uy_all[m]
    w = np.minimum(chord[m], 0.03) / 0.03
    print(f'{slug}: {m.sum()} strokes of {",".join(fit_regions)} (chord > 4 mm)')

    # the noise floor: each stroke against the common orientation of its neighbours within 2.5 cm
    tree = cKDTree(np.stack([x, y], 1))
    c2, s2 = np.cos(2 * np.arctan2(uy, ux)), np.sin(2 * np.arctan2(uy, ux))
    floor = []; band = np.full(len(x), np.nan)
    for i, nb in enumerate(tree.query_ball_point(np.stack([x, y], 1), 0.025)):
        nb = [j for j in nb if j != i]
        if len(nb) < 3: continue
        mc, ms = c2[nb].mean(), s2[nb].mean()
        if math.hypot(mc, ms) < 1e-6: continue
        th = 0.5 * math.atan2(ms, mc); band[i] = th
        d = abs(math.atan2(uy[i], ux[i]) - th) % math.pi
        floor.append(math.degrees(min(d, math.pi - d)))
    nfloor = len(floor); floor = float(np.mean(floor))
    hasb = ~np.isnan(band); bx, by = np.cos(band[hasb]), np.sin(band[hasb])
    print(f'  the noise floor (a stroke against its neighbours within 2.5 cm): {floor:.1f} deg over {nfloor} strokes')

    # the drift alone, for what the rest explains
    b0 = min(np.linspace(-math.pi / 2, math.pi / 2, 73), key=lambda b: (w * sin_of(np.array([b, 0, 0, 0, 0]), x, y, ux, uy, 0, 'gauss') ** 2).sum())
    drift_only = float(angles(np.array([b0, 0, 0, 0, 0]), x, y, ux, uy, 0, 'gauss').mean())
    print(f'  drift alone, at {math.degrees(b0):.0f} deg: residual {drift_only:.1f} deg')

    # the vortices' seeds: the depth file's funnel centres (the eddies), the moon's strokes; each kept near its seed
    seeds = [((cu - 0.5) * W, (0.5 - cv) * H, ru * W, 0.06 * W, (0.5, 2.0)) for (cu, cv, ru, rv) in laws['regions'].get('swirl', {}).get('law', {}).get('centres', [])]
    n_eddies = len(seeds)
    if 'moon' in names and (rname == 'moon').any():
        mu = mid[rname == 'moon'].mean(0); seeds.append((mu[0], mu[1], 0.07 * W, 0.03 * W, (0.5, 1.6)))

    def bounds_for(seeds):
        P0 = [b0, 0.2, 0.0, math.log(0.3), 0.0]; lo = [-math.pi, -1.0, -math.pi, math.log(0.06), -math.pi]; hi = [math.pi, 1.0, math.pi, math.log(3.0), math.pi]
        for (cx, cy, r, box, (rlo, rhi)) in seeds:
            P0 += [cx, cy, math.log(r), 2.0, 0.0]
            lo += [cx - box, cy - box, math.log(r * rlo), -15.0, -1.5]
            hi += [cx + box, cy + box, math.log(r * rhi), 15.0, 1.5]
        return np.array(P0), np.array(lo), np.array(hi)

    def fit_all(seeds, kind, signs_over):
        P0, lo, hi = bounds_for(seeds)
        nv = len(seeds); best = None
        for signs in itertools.product([1, -1], repeat=signs_over):
            P = P0.copy()
            for i, sg in enumerate(signs): P[5 + 5 * i + 3] = 2.0 * sg
            Px, res = fit(P, lo, hi, x, y, ux, uy, w, nv, kind)
            if best is None or res < best[1]: best = (Px, res, signs)
        return best

    kinds = ['gauss', 'oseen'] if a.profile == 'both' else [a.profile]
    results = {}
    for kind in kinds:
        cur = list(seeds)
        Px, res, signs = fit_all(cur, kind, n_eddies)
        print(f'  {kind}: {len(cur)} vortices, turns {"".join("+" if s > 0 else "-" for s in signs)}: residual {res:.2f} deg')
        while len(cur) < a.vortices:
            # seed one more where the residual is worst: the stroke with the most bad strokes within 6 cm
            ang = angles(Px, x, y, ux, uy, len(cur), kind)
            bad = np.where(ang > 40)[0]
            if len(bad) < 20: break
            bt = cKDTree(np.stack([x[bad], y[bad]], 1))
            counts = np.array([len(l) for l in bt.query_ball_point(np.stack([x[bad], y[bad]], 1), 0.06)])
            k = bad[counts.argmax()]
            near = bad[bt.query_ball_point([x[k], y[k]], 0.06)]
            cx, cy = x[near].mean(), y[near].mean()
            trial = cur + [(cx, cy, 0.05 * W, 0.05 * W, (0.4, 2.5))]
            # try both senses for the new vortex only, from the current fit
            P0t, lo, hi = bounds_for(trial)
            bestt = None
            for sg in (1, -1):
                P = np.concatenate([Px, [cx, cy, math.log(0.05 * W), 2.0 * sg, 0.0]])
                Pt, rt = fit(P, lo, hi, x, y, ux, uy, w, len(trial), kind)
                if bestt is None or rt < bestt[1]: bestt = (Pt, rt)
            Pt, rt = bestt
            print(f'    + a vortex at ({cx / W + 0.5:.3f}, {0.5 - cy / H:.3f}): residual {rt:.2f} deg')
            if rt < res - 0.3: cur, Px, res = trial, Pt, rt
            else: break
        results[kind] = (cur, Px, res, signs)
    kind = min(results, key=lambda k: results[k][2])
    cur, P, res, signs = results[kind]
    nv = len(cur)
    ang_fit = angles(P, x, y, ux, uy, nv, kind)
    ang_all = angles(P, mid[:, 0], mid[:, 1], ux_all, uy_all, nv, kind)
    res_band = float(angles(P, x[hasb], y[hasb], bx, by, nv, kind).mean())
    print(f'  kept {kind} with {nv} vortices: residual {res:.2f} deg (median {np.median(ang_fit):.1f}, 90th {np.percentile(ang_fit, 90):.1f}); the floor is {floor:.1f}; against his bands {res_band:.2f}')
    per_region = {nm: round(float(ang_all[(rname == nm) & (chord > 0.004)].mean()), 2) for nm in names if ((rname == nm) & (chord > 0.004)).any()}
    print('  by region:', per_region)
    # the mirrored pair (turn, in-flow) -> (-turn, -in-flow) of each eddy, for how well the lines fix its sense
    P0_, lo, hi = bounds_for(cur)
    mirrored = []
    for i in range(nv):
        Q = P.copy(); Q[5 + 5 * i + 3] *= -1; Q[5 + 5 * i + 4] *= -1
        mirrored.append(fit(Q, lo, hi, x, y, ux, uy, w, nv, kind)[1])
    beta, A, phi, loglam, psi = P[:5]
    print(f'  drift at {math.degrees(beta):.1f} deg; wave A {A:.3f} of the drift, along {math.degrees(phi):.0f} deg, lambda {100 * math.exp(loglam):.1f} cm')
    vort = []
    for i in range(nv):
        cx, cy, logr, s, q = P[5 + 5 * i:10 + 5 * i]
        r = math.exp(logr)
        u, v = cx / W + 0.5, 0.5 - cy / H
        rho = np.hypot(mid[:, 0] - cx, mid[:, 1] - cy) / r
        inside = np.isin(rname, fit_regions)
        far_m = inside & (rho < 0.35); rim_m = inside & (rho > 0.7) & (rho < 1.1)
        d_far = round(float(np.median(depth[far_m])), 1) if far_m.sum() > 5 else None
        d_rim = round(float(np.median(depth[rim_m])), 1) if rim_m.sum() > 5 else None
        vort.append({'c': [round(cx, 4), round(cy, 4)], 'uv': [round(u, 3), round(v, 3)], 'r': round(r, 4),
                     'deg': round(math.degrees(math.atan(r / f)), 2), 's': round(s, 4), 'q': round(q, 4),
                     'mirrored_residual_deg': round(mirrored[i], 2), 'depth_far_m': d_far, 'depth_rim_m': d_rim})
        print(f'  vortex {i}: at ({u:.3f}, {v:.3f}), r {100 * r:.1f} cm = {math.degrees(math.atan(r / f)):.1f} deg, turn {s:+.2f} ({"anticlockwise" if s > 0 else "clockwise"}), in-flow {q:+.3f}; mirrored: {mirrored[i]:.2f} deg; his depths: rim {d_rim} m, far end {d_far} m')
    # the flown field: the drift at --drift; the vortices, together, so that the great eddy's turn peaks at --peak,
    # and no other eddy's turn exceeds it. Vortices whose centres lie within each other's radius are one eddy
    # (the fit may give an eddy a core and a shoulder), and an eddy's turn is the most its vortices sum to.
    par = list(range(nv))
    find = lambda i: i if par[i] == i else find(par[i])
    for i in range(nv):
        for j in range(i):
            if math.dist(vort[i]['c'], vort[j]['c']) < max(vort[i]['r'], vort[j]['r']): par[find(i)] = find(j)
    eddies = {}
    for i in range(nv): eddies.setdefault(find(i), []).append(i)

    def turn_max(Pv, members):
        cx = np.mean([vort[i]['c'][0] for i in members]); cy = np.mean([vort[i]['c'][1] for i in members])
        rr = 2.0 * max(vort[i]['r'] for i in members)
        gx, gy = np.meshgrid(np.linspace(cx - rr, cx + rr, 81), np.linspace(cy - rr, cy + rr, 81))
        Fx, Fy, _ = field(Pv, gx.ravel(), gy.ravel(), nv, kind, 0.0, 1.0)
        return float(np.hypot(Fx, Fy).max())
    Pf = P.copy()
    for i in range(nv): Pf[5 + 5 * i + 4] *= a.inflow
    vscale = a.peak / turn_max(P, eddies[find(0)])
    for i in range(nv): Pf[5 + 5 * i + 3] *= vscale
    caps = {}
    for root, members in eddies.items():
        tm = turn_max(Pf, members)
        if tm > a.peak * 1.001:
            for i in members: Pf[5 + 5 * i + 3] *= a.peak / tm
            caps[root] = round(tm, 2)
    res_flown = float(angles(Pf, x, y, ux, uy, nv, kind, a.drift, 1.0).mean())
    res_flown_band = float(angles(Pf, x[hasb], y[hasb], bx, by, nv, kind, a.drift, 1.0).mean())
    print(f'  eddies: {[[i for i in mem] for mem in eddies.values()]}; vortices x {vscale:.3f} so that the great eddy turns at {a.peak} m/s; capped at {a.peak}: {caps or "none"}')
    print(f'  flown: drift {a.drift} m/s, wave {a.drift * abs(A):.2f} m/s, draw {a.draw} m/s, in-flow x {a.inflow}: residual {res_flown:.2f} deg, against his bands {res_flown_band:.2f}')
    out = {
        '_': 'The wind of the Starry Night (DESIGN 3.2, 4.7). "measured" is the fit of tools/wind.py to his sky strokes\' tangent lines, up to one scale; "authored" is what lines cannot say: which way the drift blows, and how fast in metres a second. "flown" is what src/wind.js evaluates: the fitted shape at the authored speeds, in metres a second on the canvas plane.',
        'slug': slug, 'eye': eye, 'canvas': {'W': round(W, 4), 'H': round(H, 4), 'f': round(f, 4)},
        'measured': {
            'strokes': int(m.sum()), 'regions': fit_regions, 'profile': kind,
            'noise_floor_deg': round(floor, 2), 'residual_deg': round(res, 2), 'residual_bands_deg': round(res_band, 2), 'residual_drift_only_deg': round(drift_only, 2),
            'residual_by_region_deg': per_region,
            'drift_deg': round(math.degrees(beta), 2),
            'wave': {'A': round(A, 4), 'phi': round(phi, 4), 'lam': round(math.exp(loglam), 4), 'psi': round(psi, 4)},
            'vortices': vort,
        },
        'authored': {'sense': 'the drift blows from the canvas\'s left to its right', 'drift_mps': a.drift, 'peak_mps': a.peak, 'draw_mps': a.draw, 'inflow': a.inflow,
                     'vortex_scale': round(vscale, 4), 'eddies': [[i for i in mem] for mem in eddies.values()], 'capped': caps,
                     'residual_flown_deg': round(res_flown, 2), 'residual_flown_bands_deg': round(res_flown_band, 2)},
        'flown': {
            'profile': kind,
            'drift': [round(a.drift * math.cos(beta), 4), round(a.drift * math.sin(beta), 4)],
            'wave': {'A': round(a.drift * A, 4), 'phi': round(phi, 4), 'lam': round(math.exp(loglam), 4), 'psi': round(psi, 4)},
            'vortices': [{'c': v_['c'], 'r': v_['r'], 's': round(float(Pf[5 + 5 * i + 3]), 4), 'q': round(float(Pf[5 + 5 * i + 4]), 4)} for i, v_ in enumerate(vort)],
            'draw': a.draw,
        },
    }
    os.makedirs(os.path.join(ROOT, 'hand'), exist_ok=True)
    dest = os.path.join(ROOT, 'hand', slug + '-wind.json')
    json.dump(out, open(dest, 'w'), indent=1)
    print('wrote', dest)

    # the picture: the flat dimmed, his tangents coloured by residual (green 0, red 45+), the flown field's streamlines
    flat = Image.open(os.path.join(ROOT, 'strokes', slug + '-canvas-flat.png')).convert('RGB')
    IW = 1400; IH = round(IW * H / W)
    im = Image.eval(flat.resize((IW, IH), Image.LANCZOS), lambda c: c // 3)
    dr = ImageDraw.Draw(im)
    to_px = lambda cx, cy: ((cx / W + 0.5) * IW, (0.5 - cy / H) * IH)
    for i in idx:
        a_ = min(ang_all[i] / 45.0, 1.0)
        c = (int(255 * a_), int(220 * (1 - a_)), 60)
        dr.line([to_px(X[i, 0], Y[i, 0]), to_px(X[i, 1], Y[i, 1]), to_px(X[i, 2], Y[i, 2])], fill=c, width=2)
    for (sx, sy) in [(sx, sy) for sx in np.linspace(-W / 2, W / 2, 17) for sy in np.linspace(-H / 2, H / 2, 13)]:
        pts = []
        for sgn in (1, -1):
            cx, cy = sx, sy; line = []
            for _ in range(45):
                Fx, Fy, _ = field(Pf, np.array([cx]), np.array([cy]), nv, kind, a.drift, 1.0)
                l = math.hypot(Fx[0], Fy[0]) + 1e-9; h = 0.006 * sgn
                mx, my = cx + Fx[0] / l * h / 2, cy + Fy[0] / l * h / 2
                Fx, Fy, _ = field(Pf, np.array([mx]), np.array([my]), nv, kind, a.drift, 1.0)
                l = math.hypot(Fx[0], Fy[0]) + 1e-9
                cx, cy = cx + Fx[0] / l * h, cy + Fy[0] / l * h
                if abs(cx) > W / 2 or abs(cy) > H / 2: break
                line.append(to_px(cx, cy))
            pts.append(line)
        line = pts[1][::-1] + [to_px(sx, sy)] + pts[0]
        if len(line) > 2: dr.line(line, fill=(255, 255, 255), width=1)
    for vt in vort:
        cx, cy = to_px(*vt['c']); rr = vt['r'] / W * IW
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(255, 255, 255), width=2)
        dr.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 255, 255))
    os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
    im.save(os.path.join(ROOT, 'shots', slug + '-wind.png'))
    print('wrote', os.path.join('shots', slug + '-wind.png'))


if __name__ == '__main__':
    main()
