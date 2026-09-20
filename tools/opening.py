#!/usr/bin/env python3
"""The handoff (DESIGN 7.1), pre-registered in D5: is the veil seen to go?

The opening paints The Starry Night on linen in the page while the world is built, and behind it the same canvas
is standing in three dimensions with the explosion held at nought -- that canvas whole on its own picture plane --
at the size the veil's own rectangle has on the screen. If the two agree, the veil can be taken away and what is
left is the painting. This takes both frames at one instant, over the veil's own rectangle, and compares them:
the veil's 2D brush against the runtime's ribbon, the same strokes in the same places.

It also writes down the clock of the opening: when the painting is finished, when the lift begins, and when the
explosion has run. Those times are a browser's and this is a headless one, so the log says which browser.

    tools/opening.py                       # -> shots/d5-hand-veil.png, shots/d5-hand-runtime.png
    tools/opening.py --out shots/d5-open   # and a strip of the explosion at 0, 1, 2, 3, 4 seconds
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ssim(a, b):
    a = a.astype(np.float64); b = b.astype(np.float64)
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    g = lambda x: gaussian_filter(x, 1.5)
    ma, mb = g(a), g(b)
    va, vb, cab = g(a * a) - ma * ma, g(b * b) - mb * mb, g(a * b) - ma * mb
    s = ((2 * ma * mb + C1) * (2 * cab + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
    return float(s.mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8712/')
    ap.add_argument('--out', default='shots/d5-hand')
    ap.add_argument('--width', type=int, default=1200)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--strip', action='store_true', help='also a frame of the explosion at each second')
    a = ap.parse_args()
    out = os.path.join(ROOT, a.out)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': a.width, 'height': a.height})
        pg.set_default_timeout(400000)
        pg.goto(a.url + ('&' if '?' in a.url else '?') + 'hold')
        pg.wait_for_function('window.dream && window.dream.ready', timeout=400000)
        # the veil paints on its own clock; wait for it to finish, and for the runtime to have taken its size
        pg.wait_for_function('dream.opening().painted && dream.opening().box', timeout=400000)
        o = pg.evaluate('dream.opening()')
        pg.screenshot(path=out + '-veil.png')
        # the same instant with the veil taken away: nothing else moves, because the body is held at his eye
        pg.evaluate("document.getElementById('veil').style.display = 'none'")
        pg.wait_for_timeout(350)
        pg.screenshot(path=out + '-runtime.png')
        frames = []
        if a.strip:
            pg.evaluate("document.getElementById('veil').style.display = ''")
            pg.evaluate('dream.holdOpen(false)')
            pg.evaluate('dream.wait(0.1)')
            for t in (0, 1, 2, 3, 4, 5):
                pg.evaluate(f'dream.wait({0.9 if t else 0.1})')
                st = pg.evaluate('dream.opening()')
                f = f'{out}-{t}.png'
                pg.screenshot(path=f)
                frames.append({'at': t, **st})
        b.close()
    x, y, w, h = o['box']
    A = np.asarray(Image.open(out + '-veil.png').convert('L')).astype(np.float64)
    B = np.asarray(Image.open(out + '-runtime.png').convert('L')).astype(np.float64)
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(A.shape[1], x + w), min(A.shape[0], y + h)
    a, b2 = A[y0:y1, x0:x1], B[y0:y1, x0:x1]
    S = ssim(a, b2)
    d = np.abs(a - b2)
    # the two brushes are not one brush: the veil paints in 2D with a loaded round cap, the runtime with the
    # ribbon of DESIGN 4.5, and the record's own flat is a third. So the pixels cannot agree and the question
    # the criterion was really asking is whether the *picture* is in the same place at the same size. Blurred
    # past the paint, the two are the same composition or they are not; and the offset that would line them up
    # best says in pixels whether anything jumps when the veil goes
    ga, gb = gaussian_filter(a, 6), gaussian_filter(b2, 6)
    Sb = ssim(ga, gb)
    na, nb = ga - ga.mean(), gb - gb.mean()
    best, off = -2.0, (0, 0)
    for dy in range(-24, 25, 2):
        for dx in range(-24, 25, 2):
            ca = na[max(0, dy):na.shape[0] + min(0, dy), max(0, dx):na.shape[1] + min(0, dx)]
            cb = nb[max(0, -dy):nb.shape[0] + min(0, -dy), max(0, -dx):nb.shape[1] + min(0, -dx)]
            v = float((ca * cb).sum() / (np.sqrt((ca * ca).sum() * (cb * cb).sum()) + 1e-9))
            if v > best: best, off = v, (dx, dy)
    print(json.dumps({'box': o['box'], 'hfov': o['hfov'], 'burst': o['burst'], 'stage': o['stage'],
                      'ssim': round(S, 4), 'ssim_blur6': round(Sb, 4), 'mean_abs_255': round(float(d.mean()), 2),
                      'best_offset_px': list(off), 'correlation': round(best, 4),
                      'frames': frames}))
    print('wrote', out + '-veil.png', 'and', out + '-runtime.png', file=sys.stderr)


main()
