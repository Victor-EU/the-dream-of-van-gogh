#!/usr/bin/env python3
"""Ours, in his hand (DESIGN 4.6, 5.3). What our sky is drawn from, measured from his.

Rule 3 of the build: no generator of ours is written except from a hand measured here. This tool reads a region of
one of his canvases and writes hand/<slug>-<region>.json: everything a generator needs to make a stroke that is his
in every measured respect but position -- and position follows his flow (tools/wind.py).

What is measured for the sky (--sky sky,swirl):

    density     strokes per steradian, from the region's solid angle taken off the mask itself, and the depth
                thickness of the shell his law gives that region, so that ours can be laid at strokes per
                steradian per metre of depth, which is the number BUILD.md D2 pre-registers
    the depth   his authored law read in elevation, which is a coordinate that exists outside his canvas: a line
                fitted to his sky strokes' depths, and the scatter about it
    the paints  his sky sorted by the first principal component of its colour and cut into bins of equal count.
                A colour is kept as three numbers along the axes his sky's own colours lie on, because all three
                are banded in space and not one of them is noise: two strokes a degree apart differ by about a
                quarter of the range on every axis, where chance would give a third. A generator that bands the
                first and scatters the other two speckles, and the seam shows.
                A bin is a paint: a mean colour and its spread, and with it the distributions of angular length,
                width, curl, impasto, depth off the law, and angle to its band. Sampling a paint and then its
                measurements from that paint's own tables is the joint distribution of DESIGN 4.6, kept as
                conditional tables rather than as a cloud
    the bands   his sky is banded, not salt and pepper, so the paint is coherent in space: the structure function
                of the band direction (how much two band directions differ, by their angular separation) and of
                the paint index itself, from which a generator gets the angular size of a band
    the angles  each stroke against the common orientation of its neighbours (his hand's own scatter, the noise
                floor of tools/wind.py), and each band against the fitted wind
    the bow     his strokes are curved. A stroke turned to lie along the field is compared with the arc the field
                itself would draw over that chord, and what is left over is the bow a generator must add
    the small   the shortest tenth of his sky marks, which is the hand the motes are drawn from
    the seam    his sky is not the same everywhere: his corners are darker than his mean and his strokes cover
                less angle at the edge of his cone than at its middle, because a canvas is flat and its edge is
                farther off and turned away. A generator that knows only his averages meets his edge with a step
                in it. So the edge of his cone is walked and what his sky is doing there is written down, bin by
                bin -- which paint, and how long a stroke -- and our sky carries his own value outward from it,
                letting go over the angle his paint takes to forget itself (his measured 5 degrees)

and for the stars (--star star): his eleven stars clustered on the canvas, each a core and rings, measured in
bins of radius: what share of the strokes lies at each radius, its colour, its size, and how far it lies off the
tangential direction. Our stars are few and ours, but every measurement of one is his.

    tools/hand.py starry
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from depth import read_record, rays

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QS = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]


def qs(a, k=5):
    a = np.asarray(a, float)
    if a.size == 0: return [0.0] * len(QS)
    return [round(float(v), k) for v in np.quantile(a, QS)]


def wind_plane(spec, x, y):
    """The fitted field on the canvas plane, at one scale: the drift a unit vector, the wave and the vortices with it."""
    M = spec['measured']
    b = math.radians(M['drift_deg'])
    Fx = np.full_like(x, math.cos(b)); Fy = np.full_like(x, math.sin(b))
    w = M['wave']
    ph = w['A'] * np.sin(2 * np.pi * (x * math.cos(w['phi']) + y * math.sin(w['phi'])) / w['lam'] + w['psi'])
    Fx += -math.sin(w['phi']) * ph; Fy += math.cos(w['phi']) * ph
    for v in M['vortices']:
        dx, dy = x - v['c'][0], y - v['c'][1]
        rho = np.hypot(dx, dy) + 1e-9; u = rho / v['r']
        g = v['s'] * (u * np.exp(0.5 * (1 - u * u)) if M['profile'] == 'gauss' else (1 - np.exp(-u * u)) / np.maximum(u, 1e-6))
        Fx += g * (-dy / rho - v['q'] * dx / rho); Fy += g * (dx / rho - v['q'] * dy / rho)
    return Fx, Fy


def streamline_bow(spec, x, y, L):
    """The bow of the field's own arc through (x, y) over a chord of length L: the perpendicular offset of the
    middle point from the chord's midpoint, over the chord, signed to the left of the flow. A stroke laid along
    the field gets this for nothing; what his strokes have beyond it is measured."""
    Fx, Fy = wind_plane(spec, x, y)
    n = np.hypot(Fx, Fy) + 1e-12
    tx, ty = Fx / n, Fy / n
    P = []
    for s in (-0.5, 0.5):
        cx, cy = x.copy(), y.copy()
        for _ in range(4):                                    # RK2 along the field, half a chord each way
            Fx1, Fy1 = wind_plane(spec, cx, cy); n1 = np.hypot(Fx1, Fy1) + 1e-12
            h = s * L / 4
            mx, my = cx + Fx1 / n1 * h / 2, cy + Fy1 / n1 * h / 2
            Fx2, Fy2 = wind_plane(spec, mx, my); n2 = np.hypot(Fx2, Fy2) + 1e-12
            cx, cy = cx + Fx2 / n2 * h, cy + Fy2 / n2 * h
        P.append((cx, cy))
    (ax, ay), (bx, by) = P
    ch = np.hypot(bx - ax, by - ay) + 1e-12
    ux, uy = (bx - ax) / ch, (by - ay) / ch
    mx, my = 0.5 * (ax + bx), 0.5 * (ay + by)
    return ((x - mx) * -uy + (y - my) * ux) / ch, tx, ty


def perimeter(x, y, A, B):
    """Where a point on his canvas plane stands against the edge of his cone: how far along the edge the nearest
    point of it is, from 0 to 1 going up the right side, and how far outside the point is (negative within)."""
    ax, ay = np.abs(x), np.abs(y)
    dx, dy = ax - A, ay - B                                   # positive outside
    out = np.where((dx > 0) & (dy > 0), np.hypot(dx, dy), np.maximum(dx, dy))
    vert = dx > dy                                            # nearest to a left or right side
    P = 4 * (A + B)
    cy = np.clip(y, -B, B); cx = np.clip(x, -A, A)
    t = np.where(vert,
                 np.where(x >= 0, (cy + B) / P, (2 * B + 2 * A + (B - cy)) / P),
                 np.where(y >= 0, (2 * B + (A - cx)) / P, (4 * B + 2 * A + (cx + A)) / P))
    return np.mod(t, 1.0), out


def solid_angle(mask, keys, W, H, f):
    """The solid angle each region covers, taken off the mask a person painted, pixel by pixel."""
    mh, mw = mask.shape[:2]
    u = (np.arange(mw) + 0.5) / mw; v = (np.arange(mh) + 0.5) / mh
    X = (u - 0.5) * W; Y = (0.5 - v) * H
    XX, YY = np.meshgrid(X, Y)
    dA = (W / mw) * (H / mh)
    dW = f * dA / (XX ** 2 + YY ** 2 + f ** 2) ** 1.5
    col = mask.reshape(-1, 3).astype(int)
    reg = np.argmin(((col[:, None, :] - keys[None, :, :]) ** 2).sum(-1), axis=1).reshape(mh, mw)
    return np.array([dW[reg == i].sum() for i in range(len(keys))]), reg


def structure(x, y, val, f, sep_deg, circular=False):
    """How much two values differ, by the angle between their rays: the structure function, which says how big a
    band is. Angles are halved and doubled so that a direction is a line."""
    rng = np.random.default_rng(7)
    i = rng.integers(0, len(x), 240000); j = rng.integers(0, len(x), 240000)
    ok = i != j
    i, j = i[ok], j[ok]
    d = np.degrees(np.hypot(x[i] - x[j], y[i] - y[j]) / f)
    if circular:
        dv = np.abs(np.degrees(np.arctan2(np.sin(2 * (val[i] - val[j])), np.cos(2 * (val[i] - val[j]))) / 2))
    else:
        dv = np.abs(val[i] - val[j])
    out = []
    for a, b in zip(sep_deg[:-1], sep_deg[1:]):
        m = (d >= a) & (d < b)
        if m.sum() > 200: out.append([round(0.5 * (a + b), 2), round(float(dv[m].mean()), 3), int(m.sum())])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--sky', default='sky,swirl')
    ap.add_argument('--star', default='star')
    ap.add_argument('--water', default='water', help='the surface region to measure as a covering; the hand is written to hand/<slug>-<region>.json')
    ap.add_argument('--least', type=int, default=20, help='how many strokes a cluster needs to be a star')
    ap.add_argument('--only', default='sky,star', help='which hands to measure: sky, star, water')
    ap.add_argument('--bins', type=int, default=12)
    ap.add_argument('--link', type=float, default=0.008, help='how near two star strokes must be to be the same star, m on the canvas')
    a = ap.parse_args()
    slug = a.slug
    laws = json.load(open(os.path.join(ROOT, 'depth', slug + '.json')))
    R = read_record(os.path.join(ROOT, 'strokes', slug + '-canvas.bin'))
    mask = np.asarray(Image.open(os.path.join(ROOT, 'depth', slug + '-mask.png')).convert('RGB'))
    dsc = np.fromfile(os.path.join(ROOT, 'depth', slug + '-depth.bin'), '<f4').reshape(-1, 2)
    depth, shine = dsc[:, 0].astype(float), dsc[:, 1].astype(float)
    only = set(a.only.split(','))
    wpath = os.path.join(ROOT, 'hand', slug + '-wind.json')
    spec = json.load(open(wpath)) if os.path.exists(wpath) else None    # only the sky's hand needs the wind
    n = R['n']; p = R['p']
    eye = laws['eye']
    H = R['cm'][1] / 100.0; W = H * R['px'][0] / R['px'][1]; short = min(W, H)
    f = (W / 2) / math.tan(math.radians(eye['hfov']) / 2)
    X = (p[:, :, 0] - 0.5) * W; Y = (0.5 - p[:, :, 1]) * H
    mx = 0.25 * X[:, 0] + 0.5 * X[:, 1] + 0.25 * X[:, 2]
    my = 0.25 * Y[:, 0] + 0.5 * Y[:, 1] + 0.25 * Y[:, 2]
    muv = 0.25 * p[:, 0] + 0.5 * p[:, 1] + 0.25 * p[:, 2]
    tx, ty = X[:, 2] - X[:, 0], Y[:, 2] - Y[:, 0]
    chord = np.hypot(tx, ty)
    ux, uy = tx / (chord + 1e-12), ty / (chord + 1e-12)
    # the bow: the middle point off the chord's midpoint, over the chord, to the left of the way it was traced
    bow = ((X[:, 1] - 0.5 * (X[:, 0] + X[:, 2])) * -uy + (Y[:, 1] - 0.5 * (Y[:, 0] + Y[:, 2])) * ux) / (chord + 1e-12)
    rgb = R['rgb'] ** 2.2                                    # linear, as records.js reads it
    dirs, _f = rays(muv, eye, R['cm'], R['px'])
    el = np.degrees(np.arcsin(np.clip(dirs[:, 1], -1, 1)))
    # A size on the canvas is not the size it looks from his eye: a stroke at the edge is farther off and turned
    # away, so the same centimetres cover a smaller angle. Everything a generator needs is stored as the angle it
    # is seen at, because that is what the runtime turns back into metres by multiplying by a depth -- the exact
    # angle between a stroke's two ends for its length, and the cosine of how far off his axis it lies for what
    # lies across it. Without this ours are half again too long where they meet his, at the edge of his cone
    r0, _ = rays(p[:, 0], eye, R['cm'], R['px'])
    r2, _ = rays(p[:, 2], eye, R['cm'], R['px'])
    ang = np.arccos(np.clip((r0 * r2).sum(1), -1, 1))
    ct = f / np.sqrt(mx ** 2 + my ** 2 + f ** 2)
    aw = R['w'] * short / f * ct
    acurl = R['curl'] * short / f * ct
    names = list(laws['regions'].keys())
    keys = np.array([laws['regions'][k]['key'] for k in names])
    mh, mw = mask.shape[:2]
    pxi = np.clip((muv[:, 0] * mw).astype(int), 0, mw - 1); pyi = np.clip((muv[:, 1] * mh).astype(int), 0, mh - 1)
    col = mask[pyi, pxi].astype(int)
    region = np.argmin(((col[:, None, :] - keys[None, :, :]) ** 2).sum(-1), axis=1)
    rname = np.array(names)[region]
    omega, regmap = solid_angle(mask, keys, W, H, f)
    print(f'{slug}: {n} strokes, canvas {100*W:.1f} x {100*H:.1f} cm, f {100*f:.1f} cm')
    for i, nm in enumerate(names):
        print(f'  {nm:12s} {int((region == i).sum()):6d} strokes  {omega[i]:.4f} sr')

    # a region index beside the depth sidecar, so that the runtime can tell his sky from his village at the seam
    np.array(region, '<u1').tofile(os.path.join(ROOT, 'hand', slug + '-region.bin'))

    out = {}

    # ---- the sky ------------------------------------------------------------------------------------------
    if 'sky' in only:
        sky_regions = a.sky.split(',')
        m = np.isin(rname, sky_regions)
        idx = np.where(m)[0]
        Om = float(sum(omega[names.index(r)] for r in sky_regions))
        per_sr = float(m.sum()) / Om
        # the shell: how thick his sky is at one direction, over cells of the canvas, as an effective thickness
        cu = np.clip((muv[:, 0] * 24).astype(int), 0, 23); cv = np.clip((muv[:, 1] * 20).astype(int), 0, 19)
        cell = cu * 20 + cv
        th, thw = [], []
        for c in np.unique(cell[m]):
            d = depth[m][cell[m] == c]
            if len(d) >= 30:
                th.append((np.quantile(d, 0.9) - np.quantile(d, 0.1)) / 0.8); thw.append(len(d))
        shell = float(np.median(th))
        # and the thickness a stroke stands in, averaged over strokes rather than over patches: the patches are of
        # very different size and the median of them is not what the sky is made of
        shell_w = float(np.average(th, weights=thw))
        print(f'  sky ({",".join(sky_regions)}): {m.sum()} strokes over {Om:.4f} sr = {per_sr:.0f} per sr;'
              f' the shell is {shell:.0f} m thick over {len(th)} cells ({shell_w:.0f} by stroke),'
              f' so {per_sr / shell:.2f} per sr per m ({per_sr / shell_w:.2f} by stroke)')

        # his depth law, read in elevation: a line through his sky strokes, and the scatter about it
        # his law is a line in v, the canvas's own row; ours must be read in a coordinate that exists outside the
        # canvas, and elevation is the one there is. A line in elevation is 34 m off his at the edge ours begins at,
        # because v and elevation part company off the centre column; a parabola is 15
        A = np.stack([el[m] ** 2, el[m], np.ones(m.sum())], 1)
        coef, *_ = np.linalg.lstsq(A, depth[m], rcond=None)
        dfit = A @ coef
        dres = depth[m] - dfit
        # a paint's depth is its relief within its own patch of sky, not its distance from a line drawn across the
        # whole canvas: the line cannot know his funnels, and his law is read in v where ours is read in elevation
        # The relief is what is left when his own law is taken off, not what is left of the patch's middle: a patch
        # of his sky is already a slope, because his sky is far at the hills and near overhead, and ours lays that
        # slope itself. Measured against the patch, his slope would be in both and our sky would stand a quarter too
        # deep -- D2 measured it: 51.6 m of shell against his 41.6, and 42.0 when the slope is taken off
        L = laws['regions']['skyRange']['law']
        t01 = np.clip((muv[m, 1] - L['v0']) / (L['v1'] - L['v0']), 0, 1)
        pred = L['d0'] + (L['d1'] - L['d0']) * t01
        FL = laws['regions']['swirl']['law']
        kf = np.zeros(int(m.sum()))
        for (cu, cv, ru, rv) in FL['centres']:
            rr = np.sqrt(((muv[m, 0] - cu) / ru) ** 2 + ((muv[m, 1] - cv) / rv) ** 2)
            kf = np.maximum(kf, np.clip(1.0 - rr, 0, 1) ** 2)
        pred = pred + np.where(rname[m] == 'swirl', FL['amp'] * kf, 0.0)
        drel = depth[m] / (1.0 - float(laws.get('orderNear', 0.0)) * R['order'][m]) - pred
        dof = lambda e: coef[2] + coef[1] * e + coef[0] * e * e
        print(f'  depth in elevation: {dof(0):.0f} m at the horizontal, {dof(15):.0f} at 15 deg, {dof(30):.0f} at 30;'
              f' the line is {dres.std():.0f} m off his depths, and within a patch the relief is {drel.std():.0f} m')

        # the bands: each stroke against the common orientation of its neighbours within 2.5 cm
        xs, ys = mx[m], my[m]
        uxs, uys = ux[m], uy[m]
        tree = cKDTree(np.stack([xs, ys], 1))
        th2 = np.arctan2(uys, uxs)
        c2, s2 = np.cos(2 * th2), np.sin(2 * th2)
        band = np.full(len(xs), np.nan)
        for i, nb in enumerate(tree.query_ball_point(np.stack([xs, ys], 1), 0.025)):
            nb = [j for j in nb if j != i]
            if len(nb) < 3: continue
            mc, ms = c2[nb].mean(), s2[nb].mean()
            if math.hypot(mc, ms) > 1e-6: band[i] = 0.5 * math.atan2(ms, mc)
        hasb = ~np.isnan(band)
        dsb = np.abs(np.degrees(np.arctan2(np.sin(2 * (th2[hasb] - band[hasb])), np.cos(2 * (th2[hasb] - band[hasb]))) / 2))
        floor = float(dsb.mean())
        # the band against the fitted wind
        Fx, Fy = wind_plane(spec, xs, ys)
        thf = np.arctan2(Fy, Fx)
        dbf = np.degrees(np.arctan2(np.sin(2 * (band[hasb] - thf[hasb])), np.cos(2 * (band[hasb] - thf[hasb]))) / 2)
        print(f'  a stroke off its band {floor:.2f} deg (the noise floor); a band off the fitted wind'
              f' {np.abs(dbf).mean():.2f} deg, spread {dbf.std():.2f}')

        # the paints: bins of equal count along the first principal component of his colour
        C = rgb[m]
        W_, VV = np.linalg.eigh(np.cov((C - rgb[m].mean(0)).T))
        AX = np.stack([VV[:, -1], VV[:, -2], VV[:, -3]], 1)          # by how much of his colour lies along each
        # the seam: his sky within three degrees of the canvas's edge, which is where ours begins
        eu, ev = muv[m, 0], muv[m, 1]
        edge_m = 3.0 * math.pi / 180 * f
        edgem = (np.minimum(np.minimum(eu * W, (1 - eu) * W), np.minimum(ev * H, (1 - ev) * H)) < edge_m)
        Cm = C.mean(0)
        if AX[:, 0].sum() < 0: AX = AX * np.array([-1.0, 1.0, 1.0])
        AP = (C - Cm) @ AX
        t = AP[:, 0]
        print(f'  his colour lies along three axes, {100*W_[-1]/W_.sum():.0f}%, {100*W_[-2]/W_.sum():.0f}%'
              f' and {100*W_[-3]/W_.sum():.0f}% of it; our sky bands the first two and scatters the third')
        order = np.argsort(t)
        edges = [order[int(round(k * len(order) / a.bins))] for k in range(a.bins)] + [order[-1]]
        lim = [float(t[e]) for e in edges]
        bidx = np.clip(np.searchsorted(np.array(lim[1:-1]), t), 0, a.bins - 1)
        # the bow his strokes have beyond the arc the field itself draws
        bw_f, ftx, fty = streamline_bow(spec, xs, ys, np.maximum(chord[m], 0.004))
        flip = np.where(uxs * ftx + uys * fty < 0, -1.0, 1.0)     # turned to lie along the field
        bw_s = bow[m] * flip
        bres = bw_s - bw_f
        print(f'  the bow: his {np.abs(bw_s).mean():.3f} of a chord, the field\'s own arc {np.abs(bw_f).mean():.3f},'
              f' what is left {np.abs(bres).mean():.3f} (correlation {np.corrcoef(bw_s, bw_f)[0,1]:+.2f})')

        dbn = np.degrees(np.arctan2(np.sin(2 * (th2 - np.where(hasb, band, thf))), np.cos(2 * (th2 - np.where(hasb, band, thf)))) / 2)
        # A stroke's depth off its patch is three things: what paint it is (his pale bands stand forward of his dark
        # ones), what the patch itself is doing, and the stroke's own. Ours gets the first from the paint it drew and
        # the second from its own law and its own funnels, so only the third may be drawn at random -- pooled, the
        # second would be counted twice and our sky would stand half again too deep
        a_paint = np.array([drel[bidx == b].mean() if (bidx == b).any() else 0.0 for b in range(a.bins)])
        e = drel - a_paint[bidx]
        pat = np.zeros_like(e); esp = np.full(len(e), np.nan)
        for c in np.unique(cell[m]):
            k = cell[m] == c
            pat[k] = e[k].mean()
            e[k] -= pat[k]
            if k.sum() >= 20: esp[k] = (np.quantile(e[k], 0.9) - np.quantile(e[k], 0.1)) / 0.8
        # and what is left to the stroke is measured patch by patch, not in one heap: pooled, a few deep patches
        # stretch the tails and a generator drawing from them gives every patch the spread of the deepest
        emed = float(np.nanmedian(esp))
        e = e * np.clip(emed / np.where(np.isnan(esp), emed, esp), 0.35, 2.5)
        print(f'  the relief: {drel.std():.1f} m off the patch -- the paint {a_paint[bidx].std():.1f},'
              f' the patch itself {pat.std():.1f}, the stroke\'s own {e.std():.1f}'
              f' (a typical patch spreads it {emed:.0f} m, the heap of them {np.nanmax(esp):.0f} at most)')
        paints = []
        for b in range(a.bins):
            k = bidx == b
            paints.append({
                'share': round(float(k.mean()), 4),
                'rgb': [round(float(v), 5) for v in C[k].mean(0)],
                'sd': [round(float(v), 5) for v in C[k].std(0)],
                'a': [qs(AP[k, 0]), qs(AP[k, 1]), qs(AP[k, 2])],
                'len': qs(ang[m][k]), 'wid': qs(aw[m][k]), 'curl': qs(acurl[m][k]),
                'h_mm': qs(R['h'][m][k] * R['height_mm'], 3), 'ddep': qs(e[k], 2), 'ddep_mean': round(float(a_paint[b]), 2), 'bow': qs(bres[k], 4),
                'off': qs(dbn[k], 2),
            })
        for b, P in enumerate(paints):
            print(f'    paint {b:2d} {P["share"]*100:4.1f}%  rgb {P["rgb"]}  length {1000*P["len"][3]:.0f} mrad'
                  f'  depth {P["ddep"][3]:+.0f} m')
        small = chord[m] <= np.quantile(chord[m], 0.1)
        sm = {'n': int(small.sum()), 'rgb': [round(float(v), 5) for v in C[small].mean(0)], 'sd': [round(float(v), 5) for v in C[small].std(0)],
              'len': qs(ang[m][small]), 'wid': qs(aw[m][small]), 'curl': qs(acurl[m][small]),
              'h_mm': qs(R['h'][m][small] * R['height_mm'], 3)}
        # the seam profile: what his sky is doing along the edge of his cone, bin by bin round it
        NP = 96
        A2, B2 = W / 2, H / 2
        tt, oo = perimeter(mx[m], my[m], A2, B2)
        inb = (oo < 0) & (oo > -6.0 * math.pi / 180 * f)
        qt = (bidx + 0.5) / a.bins
        bin_t = np.clip((tt * NP).astype(int), 0, NP - 1)
        prof_q, prof_l, prof_c, prof_n = [], [], [], []
        for b in range(NP):
            k = inb & (bin_t == b)
            prof_n.append(int(k.sum()))
            prof_q.append(round(float(qt[k].mean()), 4) if k.sum() >= 8 else None)
            prof_l.append(round(float(ang[m][k].mean()), 5) if k.sum() >= 8 else None)
            prof_c.append([round(float(v), 5) for v in C[k].mean(0)] if k.sum() >= 8 else None)
        # smoothed round the edge, so that a bin with few strokes leans on its neighbours
        def smooth(v):
            out = []
            for b in range(NP):
                w = [v[(b + d) % NP] for d in (-2, -1, 0, 1, 2) if v[(b + d) % NP] is not None]
                out.append(round(float(np.mean(w)), 5) if w else None)
            return out
        prof_q, prof_l = smooth(prof_q), smooth(prof_l)
        prof_c = [None if all(prof_c[(b + d) % NP] is None for d in (-2, -1, 0, 1, 2)) else
                  [round(float(np.mean([prof_c[(b + d) % NP][j] for d in (-2, -1, 0, 1, 2) if prof_c[(b + d) % NP] is not None])), 5) for j in range(3)]
                  for b in range(NP)]
        have = sum(1 for v in prof_q if v is not None)
        print(f'  the seam: his sky is along {have} of {NP} bins of the edge of his cone;'
              f' its paint runs {min(v for v in prof_q if v is not None):.2f} to {max(v for v in prof_q if v is not None):.2f}'
              f' where his sky as a whole is 0.50, and its strokes {1000*min(v for v in prof_l if v is not None):.0f}'
              f' to {1000*max(v for v in prof_l if v is not None):.0f} mrad where his mean is {1000*ang[m].mean():.0f}')
        seps = [0, 0.4, 0.8, 1.6, 3.2, 6.4, 12.8, 25.6]
        out['sky'] = {
            '_': 'The Starry Night\'s sky, measured (DESIGN 4.6): what a stroke of ours is drawn from. Angles are in radians as seen from his standpoint, so that a length is the stroke\'s angular size and the runtime makes it metres by multiplying by the depth, exactly as explode.js scales his. A paint is a bin of his colours: pick one, then take its own length, width, curl, impasto, depth off the law, and angle off its band.',
            'slug': slug, 'regions': sky_regions, 'n': int(m.sum()),
            'canvas': {'W': round(W, 4), 'H': round(H, 4), 'f': round(f, 4), 'short': round(short, 4)}, 'eye': eye,
            'density': {'solid_angle_sr': round(Om, 4), 'per_sr': round(per_sr, 1), 'shell_m': round(shell, 1), 'shell_by_stroke_m': round(shell_w, 1),
                        'per_sr_per_m': round(per_sr / shell, 3), 'per_sr_per_m_by_stroke': round(per_sr / shell_w, 3),
                        'cells': len(th)},
            'depth': {'by_elevation': [round(float(coef[2]), 2), round(float(coef[1]), 4), round(float(coef[0]), 5)],
                      'range_m': [round(float(np.quantile(depth[m], 0.02)), 1), round(float(np.quantile(depth[m], 0.98)), 1)],
                      'line_error_m': round(float(dres.std()), 1), 'relief_m': round(float(drel.std()), 1),
                      'seam_error_m': round(float(dres[edgem].std()), 1), 'seam_bias_m': round(float(dres[edgem].mean()), 1)},
            'seam': {'band_deg': 3.0, 'n': int(edgem.sum()), 'rgb': [round(float(v), 5) for v in C[edgem].mean(0)],
                     'len': round(float(ang[m][edgem].mean()), 5), 'wid': round(float(aw[m][edgem].mean()), 5)},
            'bands': {'stroke_off_band_deg': round(floor, 2), 'band_off_wind_deg': round(float(np.abs(dbf).mean()), 2),
                      'band_off_wind_sd_deg': round(float(dbf.std()), 2),
                      'direction_structure_deg': structure(xs, ys, np.where(hasb, band, thf), f, seps, circular=True),
                      'paint_structure': structure(xs, ys, (bidx + 0.5) / a.bins, f, seps)},
            'bow': {'his': round(float(np.abs(bw_s).mean()), 4), 'field': round(float(np.abs(bw_f).mean()), 4),
                    'left': round(float(np.abs(bres).mean()), 4), 'correlation': round(float(np.corrcoef(bw_s, bw_f)[0, 1]), 3)},
            'eddies': {'n': len(spec['measured']['vortices']), 'per_sr': round(len(spec['measured']['vortices']) / Om, 2),
                       'radius_deg': [v['deg'] for v in spec['measured']['vortices']]},
            'edge': {'n': NP, 'A': round(A2, 4), 'B': round(B2, 4), 'band_deg': 6.0, 'let_go_deg': 5.0, 'let_go_size_deg': 12.0,
                     'len_mean': round(float(ang[m].mean()), 5), 'q': prof_q, 'len': prof_l, 'rgb': prof_c},
            'colour': {'mean': [round(float(v), 5) for v in Cm], 'axes': [[round(float(v), 5) for v in AX[:, j]] for j in range(3)],
                       'share': [round(float(W_[-1 - j] / W_.sum()), 4) for j in range(3)],
                       'structure': [structure(xs, ys, np.argsort(np.argsort(AP[:, j])) / len(AP), f, seps) for j in range(2)]},
            'paints': paints, 'small': sm,
        }

    # ---- the stars ----------------------------------------------------------------------------------------
    if 'star' in only:
     ms = rname == a.star
     sx, sy = mx[ms], my[ms]
     st = cKDTree(np.stack([sx, sy], 1))
     pairs = st.query_pairs(a.link, output_type='ndarray')
     par = list(range(len(sx)))
     def find(i):
         while par[i] != i: par[i] = par[par[i]]; i = par[i]
         return i
     for i, j in pairs:
         a_, b_ = find(i), find(j)
         if a_ != b_: par[a_] = b_
     groups = {}
     for i in range(len(sx)): groups.setdefault(find(i), []).append(i)
     stars = [g for g in groups.values() if len(g) >= a.least]
     stars.sort(key=lambda g: -len(g))
     RB = [0.0, 0.25, 0.5, 0.75, 1.0, 1.4]
     rings = [[] for _ in range(len(RB) - 1)]
     sizes = []; counts = []
     for g in stars:
         gx, gy = sx[g], sy[g]
         cx, cy = gx.mean(), gy.mean()
         r = np.hypot(gx - cx, gy - cy)
         Rst = float(np.quantile(r, 0.9)) + 1e-9
         sizes.append(Rst / f * float(np.median(ct[ms][g]))); counts.append(len(g))
         gi = np.array(g)
         u = r / Rst
         # how far the stroke lies off the tangential direction at its place in the star
         px_, py_ = -(gy - cy) / (r + 1e-9), (gx - cx) / (r + 1e-9)
         cosd = np.abs(ux[ms][gi] * px_ + uy[ms][gi] * py_)
         offt = np.degrees(np.arccos(np.clip(cosd, 0, 1)))
         for b in range(len(RB) - 1):
             k = (u >= RB[b]) & (u < RB[b + 1])
             if k.any(): rings[b].append((gi[k], u[k], offt[k]))
     ringsout = []
     tot = max(1, sum(sum(len(i) for i, _, _ in rb) for rb in rings))
     for b, rb in enumerate(rings):
         if not rb: ringsout.append(None); continue
         gi = np.concatenate([i for i, _, _ in rb]); off = np.concatenate([o for _, _, o in rb])
         C2 = rgb[ms][gi]
         ringsout.append({'r': [RB[b], RB[b + 1]], 'share': round(len(gi) / tot, 4),
                          'rgb': [round(float(v), 5) for v in C2.mean(0)], 'sd': [round(float(v), 5) for v in C2.std(0)],
                          'len': qs(ang[ms][gi]), 'wid': qs(aw[ms][gi]), 'curl': qs(acurl[ms][gi]),
                          'h_mm': qs(R['h'][ms][gi] * R['height_mm'], 3), 'off_tangent_deg': qs(off, 2),
                          'shine': round(float(shine[ms][gi].mean()), 3)})
     allc = sorted((len(g) for g in groups.values()), reverse=True)
     if not stars:
         print(f'  stars: none of {len(groups)} clusters in {int(ms.sum())} strokes has the {a.least} marks a'
               f' star needs; the biggest are {allc[:6]}. This canvas paints a star as a dab and not as a core'
               f' and rings, so it has no hand to give one')
     else:
         print(f'  stars: {len(stars)} of {int(ms.sum())} strokes, {min(counts)} to {max(counts)} strokes each,'
               f' radius {np.degrees(min(sizes)):.1f} to {np.degrees(max(sizes)):.1f} deg')
     for b, rr in enumerate(ringsout):
         if rr: print(f'    ring {RB[b]:.2f}-{RB[b+1]:.2f}  {rr["share"]*100:4.1f}%  rgb {rr["rgb"]}  off the tangent {rr["off_tangent_deg"][3]:.0f} deg')
     out['star'] = {
         '_': 'His eleven stars, measured (DESIGN 5.3): each a core and rings. Radii are fractions of the star\'s own, which is the 90th percentile of its strokes\' distance from its centre; sizes are in radians as seen from his standpoint. Our stars are few and unnamed, but every measurement of one is his.',
         'slug': slug, 'region': a.star, 'n': int(ms.sum()), 'stars': len(stars),
         'clusters': allc[:20], 'least': a.least,
         'canvas': {'f': round(f, 4)}, 'link_m': a.link,
         'per_star': {'strokes': qs(counts, 1), 'radius_rad': qs(sizes)},
         'rings': [r for r in ringsout if r],
     }


    # ---- the water ----------------------------------------------------------------------------------------
    # His Rhone's water between the columns: 1,061 horizontal dashes, and what a generator needs of them is not
    # a density in the world -- his brush is one size on a canvas, not one size on a river -- but a coverage:
    # what share of the water his paint covers, how long a mark is against the spacing between marks, and which
    # way it lies. Those three are scale-free, so our sea can carry his hand at whatever spacing a person sets.
    if 'water' in only:
     mw_ = rname == a.water
     if mw_.sum():
      mh2, mw2 = mask.shape[:2]
      keyw = np.array(laws['regions'][a.water]['key'])
      pix = int(np.all(mask == keyw, axis=-1).sum())
      area = pix * (W / mw2) * (H / mh2)                       # the region's area on the canvas, m^2
      cov = float((chord[mw_] * R['w'][mw_] * short).sum() / max(area, 1e-9))
      sp = math.sqrt(area / mw_.sum())                         # the spacing between marks, m on the canvas
      lie = np.degrees(np.arctan2(ty[mw_], tx[mw_]))
      lie = np.abs((lie + 90) % 180 - 90)                      # how far off horizontal, 0 to 90
      lum2 = rgb[mw_] @ [0.2126, 0.7152, 0.0722]
      qb = np.quantile(lum2, np.linspace(0, 1, 9))
      bidx2 = np.clip(np.searchsorted(qb, lum2, 'right') - 1, 0, 7)
      bins = []
      for b in range(8):
          k2 = bidx2 == b
          bins.append(None if not k2.any() else
                      {'share': round(float(k2.mean()), 4),
                       'rgb': [round(float(v), 5) for v in rgb[mw_][k2].mean(0)],
                       'sd': [round(float(v), 5) for v in rgb[mw_][k2].std(0)],
                       'lum': round(float(lum2[k2].mean()), 5),
                       'len_over_spacing': qs(chord[mw_][k2] / sp, 4),
                       'wid_over_spacing': qs(R['w'][mw_][k2] * short / sp, 4)})
      out[a.water if a.water != 'water' else 'water'] = {
        '_': "His Rhone's water, measured (DESIGN 5.2, 5.3). Not a density in the world but a coverage on the "
             "canvas: the share of the water his paint covers, and every measure of a mark against the spacing "
             "between marks, which is the square root of the water's area over the number of marks. A mark's "
             "lie is how far off horizontal it is on his canvas, and horizontal on a water seen from a bank is "
             "across the line of sight, which is the way a wave's front lies. Ours lie across the drift of the "
             "wind for the same reason, and that is the one thing in this hand that is a person's reading of it.",
        'slug': slug, 'region': a.water, 'n': int(mw_.sum()),
        'canvas': {'W': round(W, 4), 'H': round(H, 4), 'f': round(f, 4), 'area_m2': round(area, 4)},
        'cover': round(cov, 4), 'spacing_m': round(sp, 5),
        'mark': {'len_over_spacing': qs(chord[mw_] / sp, 4), 'wid_over_spacing': qs(R['w'][mw_] * short / sp, 4),
                 'len_over_wid': qs(chord[mw_] / np.maximum(R['w'][mw_] * short, 1e-6), 3),
                 'lie_deg': qs(lie, 2), 'bow': qs(np.abs(bow[mw_]), 4),
                 'curl_over_spacing': qs(R['curl'][mw_] * short / sp, 4),
                 'h_mm': qs(R['h'][mw_] * R['height_mm'], 3)},
        'colour': {'bins': bins, 'edges': [round(float(v), 5) for v in qb]},
      }
      print(f"  the water: {int(mw_.sum())} marks over {area:.3f} m2 of canvas, covering {100*cov:.1f}% of it;"
            f" spacing {100*sp:.2f} cm, a mark {np.median(chord[mw_])/sp:.2f} of it long and"
            f" {np.median(R['w'][mw_]*short)/sp:.2f} wide, lying {np.median(lie):.0f} deg off horizontal")

    os.makedirs(os.path.join(ROOT, 'hand'), exist_ok=True)
    for k, v in out.items():
        dest = os.path.join(ROOT, 'hand', f'{slug}-{k}.json')
        json.dump(v, open(dest, 'w'), indent=1)
        print('wrote', dest)
    print('wrote', os.path.join('hand', slug + '-region.bin'))


if __name__ == '__main__':
    main()
