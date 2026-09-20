#!/usr/bin/env python3
"""A first region mask for a canvas, from rules, so that a person has something to repaint.

DESIGN.md 4.3 wants a region mask painted by hand over the flat rendering of a record. This writes the first one
from a handful of rules -- a few polylines typed from looking at the canvas, and colour tests on the flat -- so
that the depth laws can be tried on the same day. The mask it writes, depth/<slug>-mask.png, is the authored
thing from then on: repaint it in any editor, keep the palette, and rerun tools/depth.py. This script is not run
again unless a person wants to start over.

The palette is the one depth/<slug>.json names for its regions. A pixel is the region whose key colour it carries.

    tools/mask.py starry
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def polyline(points):
    xs = np.array([p[0] for p in points]); ys = np.array([p[1] for p in points])
    return lambda u: np.interp(u, xs, ys)


def inside(poly, U, V):
    """Even-odd test of (U, V) arrays against a polygon of (u, v) pairs."""
    x = np.array([p[0] for p in poly]); y = np.array([p[1] for p in poly])
    n = len(x); res = np.zeros(U.shape, bool)
    j = n - 1
    for i in range(n):
        cond = ((y[i] > V) != (y[j] > V)) & (U < (x[j] - x[i]) * (V - y[i]) / (y[j] - y[i] + 1e-12) + x[i])
        res ^= cond
        j = i
    return res


def starry(flat, keys):
    H, W = flat.shape[:2]
    U = (np.arange(W) + 0.5) / W; V = (np.arange(H) + 0.5) / H
    U, V = np.meshgrid(U, V)
    rgb = flat[..., :3].astype(np.float64) / 255.0
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    yellow = np.clip((rgb[..., 0] + rgb[..., 1]) * 0.5 - rgb[..., 2], 0, 1)
    out = np.zeros((H, W, 3), np.uint8)
    put = lambda m, name: out.__setitem__(m, keys[name])

    # the ridge of the hills, and the top of the village, typed from the canvas
    ridge = polyline([(0.0, 0.80), (0.30, 0.76), (0.40, 0.69), (0.50, 0.66), (0.58, 0.68), (0.65, 0.68),
                      (0.75, 0.62), (0.85, 0.55), (0.92, 0.52), (1.0, 0.55)])
    vill = polyline([(0.0, 0.84), (0.30, 0.79), (0.45, 0.76), (0.60, 0.75), (0.75, 0.72), (0.90, 0.70), (1.0, 0.69)])
    put(np.ones((H, W), bool), 'sky')
    put(V >= ridge(U), 'hills')
    put(V >= vill(U), 'village')
    # the spire: a thin dark tower standing up out of the village into the hills
    spire = (U > 0.545) & (U < 0.585) & (V > 0.60) & (V < vill(U)) & (lum < 0.45)
    put(spire, 'village')
    # the cypress: a flame on the left; dark where it is, and the sky shows between its lobes
    cyp = [(0.02, 1.0), (0.38, 1.0), (0.37, 0.92), (0.34, 0.78), (0.31, 0.64), (0.28, 0.52), (0.25, 0.42), (0.23, 0.32),
           (0.215, 0.22), (0.205, 0.12), (0.195, 0.02), (0.16, 0.02), (0.15, 0.14), (0.14, 0.28), (0.13, 0.42),
           (0.11, 0.56), (0.07, 0.72), (0.03, 0.86)]
    put(inside(cyp, U, V) & (lum < 0.36), 'cypress')
    # the moon: the bright disc, top right; its rings stay sky
    moon = ((U - 0.905) * W) ** 2 + ((V - 0.17) * H) ** 2 < (0.085 * W) ** 2
    put(moon & (lum > 0.55), 'moon')
    # the stars: bright knots in the sky, with their haloes, found rather than typed
    sky = np.all(out == keys['sky'], axis=-1)
    bright = sky & (lum > 0.60) & ~moon
    bright = ndimage.binary_opening(bright, iterations=2)
    lab, n = ndimage.label(bright)
    sizes = ndimage.sum(bright, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > (W * 0.012) ** 2])
    keep = ndimage.binary_dilation(keep, iterations=int(W * 0.006)) & sky
    put(keep, 'star')
    # the two eddies, as the sky's relief: typed ellipses
    for (cu, cv, ru, rv) in [(0.49, 0.34, 0.17, 0.15), (0.69, 0.45, 0.085, 0.075)]:
        e = ((U - cu) / ru) ** 2 + ((V - cv) / rv) ** 2 < 1.0
        put(e & sky & ~keep, 'swirl')
    return out


def rhone(flat, keys):
    """The Rhone: four bands and two people. The waterline is the one tools/columns.py typed in D3 and it is
    kept, letter for letter, because the same line cannot be two lines. Above it the town's bank, above that
    the sky; below it everything is the water's own plane, shore and all, which is what the couple's height
    proves (depth/rhone.json). The lamps are not a region: they are the bank's bright yellows, found by the
    `windows` test, because a gaslight is not at a different distance from the wall it stands against."""
    H, W = flat.shape[:2]
    U = (np.arange(W) + 0.5) / W; V = (np.arange(H) + 0.5) / H
    U, V = np.meshgrid(U, V)
    rgb = flat[..., :3].astype(np.float64) / 255.0
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    out = np.zeros((H, W, 3), np.uint8)
    put = lambda m, name: out.__setitem__(m, keys[name])

    # the top of the far bank, and the waterline (the latter is tools/columns.py's WATERLINE)
    skyline = polyline([(0.0, 0.412), (0.20, 0.404), (0.40, 0.400), (0.55, 0.406), (0.70, 0.414), (0.85, 0.418), (1.0, 0.420)])
    water = polyline([(0.0, 0.483), (0.25, 0.479), (0.5, 0.476), (0.75, 0.472), (1.0, 0.470)])
    put(np.ones((H, W), bool), 'sky')
    put(V >= skyline(U), 'farbank')
    put(V >= water(U), 'water')
    # the couple on the shore, typed from the canvas: the two shells of DESIGN 15.9
    couple = [(0.719, 1.0), (0.713, 0.93), (0.719, 0.865), (0.729, 0.812), (0.748, 0.788), (0.771, 0.790),
              (0.787, 0.812), (0.800, 0.855), (0.808, 0.912), (0.811, 1.0)]
    put(inside(couple, U, V), 'couple')
    # his stars: bright knots in the sky, found rather than typed, as the Starry Night's are
    sky = np.all(out == keys['sky'], axis=-1)
    bright = sky & (lum > 0.42)
    bright = ndimage.binary_opening(bright, iterations=2)
    lab, n = ndimage.label(bright)
    sizes = ndimage.sum(bright, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > (W * 0.007) ** 2])
    keep = ndimage.binary_dilation(keep, iterations=int(W * 0.004)) & sky
    put(keep, 'star')
    return out


def cafeterrace(flat, keys):
    """The terrace: the one place in the piece with walls. Nine boundaries typed off the canvas -- the awning's
    outer edge and its far edge, the line where everything standing meets the ground, the sky's lower edge
    against the roofs and the tree, the alley between the awning and the houses -- and two things found rather
    than typed: his stars, and the pale table tops, which are the one shape on this canvas that repeats."""
    H, W = flat.shape[:2]
    U = (np.arange(W) + 0.5) / W; V = (np.arange(H) + 0.5) / H
    U, V = np.meshgrid(U, V)
    rgb = flat[..., :3].astype(np.float64) / 255.0
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    yellow = np.clip((rgb[..., 0] + rgb[..., 1]) * 0.5 - rgb[..., 2], 0, 1)
    out = np.zeros((H, W, 3), np.uint8)
    put = lambda m, name: out.__setitem__(m, keys[name])

    # the awning: its outer edge (nearest, highest in the frame) and its far edge, where the terrace ends
    aw_top = polyline([(0.085, 0.145), (0.20, 0.198), (0.32, 0.243), (0.44, 0.283), (0.55, 0.315)])
    aw_bot = polyline([(0.085, 0.560), (0.20, 0.520), (0.32, 0.492), (0.44, 0.472), (0.55, 0.458)])
    # the ground line: under the cafe's wall, under the awning, under the houses across the road
    ground = polyline([(0.0, 0.800), (0.084, 0.790), (0.090, 0.560), (0.20, 0.520), (0.32, 0.492),
                       (0.44, 0.472), (0.549, 0.458), (0.556, 0.615), (0.70, 0.625), (0.85, 0.645), (1.0, 0.665)])
    # the sky's lower edge, against the awning on the left and the roofs and the tree on the right
    skybot = polyline([(0.28, 0.000), (0.34, 0.120), (0.42, 0.235), (0.50, 0.298), (0.58, 0.288),
                       (0.66, 0.248), (0.74, 0.175), (0.80, 0.100), (0.86, 0.020), (1.0, 0.000)])

    put(np.ones((H, W), bool), 'street')
    put((V < skybot(U)) & (U > 0.28), 'sky')
    put((U < 0.135) | ((U < 0.280) & (V < aw_top(U))), 'facade')   # the cafe's wall, and its upper storey over the awning
    put((U >= 0.085) & (U <= 0.552) & (V >= aw_top(U)) & (V <= aw_bot(U)), 'awning')
    put((U > 0.552) & (U < 0.648) & (V > 0.300) & (V < ground(U)), 'alley')
    put(V >= ground(U), 'pavement')
    # the tables: pale tops, found. They are the one repeated shape on the canvas and they are not a plane
    terr = (U > 0.10) & (U < 0.56) & (V > 0.44) & (V < 0.82)
    pale = terr & (lum > 0.50) & (yellow < 0.26)
    pale = ndimage.binary_opening(pale, iterations=2)
    lab, n = ndimage.label(pale)
    sizes = ndimage.sum(pale, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > (W * 0.011) ** 2])
    put(keep, 'table')
    # the people in the road, typed: the waiter who gives the horizon, and the group beyond him
    for poly in ([(0.617, 0.665), (0.617, 0.578), (0.632, 0.570), (0.652, 0.578), (0.652, 0.665)],
                 [(0.660, 0.640), (0.660, 0.540), (0.700, 0.532), (0.720, 0.545), (0.720, 0.640)],
                 [(0.735, 0.620), (0.735, 0.545), (0.775, 0.545), (0.775, 0.620)]):
        put(inside(poly, U, V), 'figure')
    # his stars: few, pale, and not yellow -- the opposite test to the Rhone's
    sky = np.all(out == keys['sky'], axis=-1)
    bright = sky & (lum > 0.46)
    bright = ndimage.binary_opening(bright, iterations=2)
    lab, n = ndimage.label(bright)
    sizes = ndimage.sum(bright, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > (W * 0.008) ** 2])
    keep = ndimage.binary_dilation(keep, iterations=int(W * 0.004)) & sky
    put(keep, 'star')
    return out


RULES = {'starry': starry, 'rhone': rhone, 'cafeterrace': cafeterrace}


def main():
    slug = sys.argv[1]
    laws = json.load(open(os.path.join(ROOT, 'depth', slug + '.json')))
    keys = {name: tuple(r['key']) for name, r in laws['regions'].items()}
    flat = np.asarray(Image.open(os.path.join(ROOT, 'strokes', slug + '-canvas-flat.png')).convert('RGB'))
    mask = RULES[slug](flat, keys)
    dest = os.path.join(ROOT, 'depth', slug + '-mask.png')
    Image.fromarray(mask).save(dest)
    tot = mask.shape[0] * mask.shape[1]
    for name, k in keys.items():
        c = int(np.all(mask == k, axis=-1).sum())
        print(f'{name:10s} {100 * c / tot:5.1f}%')
    print('wrote', dest, mask.shape[1], 'x', mask.shape[0])


if __name__ == '__main__':
    main()
