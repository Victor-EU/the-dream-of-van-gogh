#!/usr/bin/env python3
"""The standpoint test (DESIGN 4.4), pre-registered: from his eye, with his field of view, the frame must
reproduce the record's flat rendering. SSIM >= 0.85 at 512 px on the long edge, and no 32 px cell whose mean
colour is off by more than 8% of full scale.

The frame is taken headless at the scan's aspect with `?test`, which puts the eye at the standpoint, gives the
camera the canvas's field of view and holds the body still. The flat is the pipeline's own rendering of the
record (strokes/<slug>-canvas-flat.png), the same strokes drawn flat in the same order, so the test isolates
the geometry -- and, since the runtime's brush and light are not the pipeline's, a second number is printed
against the runtime's own flat: the same frame with every depth equal (`&flat`), which is what the geometry alone
should be judged by if the first fails on texture rather than on placement.

    tools/standpoint.py starry
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable


def ssim(a, b):
    a = a.astype(np.float64); b = b.astype(np.float64)
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    g = lambda x: gaussian_filter(x, 1.5)
    ma, mb = g(a), g(b)
    va, vb, cab = g(a * a) - ma * ma, g(b * b) - mb * mb, g(a * b) - ma * mb
    s = ((2 * ma * mb + C1) * (2 * cab + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
    return float(s.mean())


def compare(frame, flat, long=512, cell=32):
    w, h = flat.size
    s = long / max(w, h)
    size = (round(w * s), round(h * s))
    A = np.asarray(frame.convert('RGB').resize(size, Image.LANCZOS)).astype(np.float64)
    B = np.asarray(flat.convert('RGB').resize(size, Image.LANCZOS)).astype(np.float64)
    gA = A @ [0.299, 0.587, 0.114]; gB = B @ [0.299, 0.587, 0.114]
    S = ssim(gA, gB)
    worst = 0.0; where = None; bad = 0
    for y in range(0, size[1] - cell + 1, cell):
        for x in range(0, size[0] - cell + 1, cell):
            d = np.abs(A[y:y + cell, x:x + cell].mean((0, 1)) - B[y:y + cell, x:x + cell].mean((0, 1))).max() / 255.0
            if d > worst: worst, where = d, (x / size[0], y / size[1])
            if d > 0.08: bad += 1
    return S, worst, where, bad


SLUGS = ['starry', 'rhone', 'cafeterrace']                  # the order src/main.js CANVASES has them in


def main():
    slug = sys.argv[1]
    url = 'http://127.0.0.1:8712/'
    extra = ''.join('&' + a for a in sys.argv[2:])          # e.g. exposure=1.5
    at = SLUGS.index(slug) + 1 if slug in SLUGS else 1
    extra = f'&at={at}' + extra
    flat = Image.open(os.path.join(ROOT, 'strokes', slug + '-canvas-flat.png'))
    w, h = flat.size
    W = 1200; H = round(W * h / w)
    os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
    out = os.path.join(ROOT, 'shots', slug + '-standpoint.png')
    subprocess.run([PY, os.path.join(ROOT, 'tools', 'shot.py'), '--url', f'{url}?test&notitle{extra}', '--out', out, '--width', str(W), '--height', str(H)], check=True, capture_output=True)
    frame = Image.open(out)
    S, worst, where, bad = compare(frame, flat)
    ok = S >= 0.85 and bad == 0
    print(f'{slug} against the record\'s flat: SSIM {S:.3f}, worst cell {100 * worst:.1f}% at ({where[0]:.2f}, {where[1]:.2f}), cells over 8%: {bad}  ->  {"pass" if ok else "FAIL"}')
    out2 = os.path.join(ROOT, 'shots', slug + '-standpoint-flat.png')
    subprocess.run([PY, os.path.join(ROOT, 'tools', 'shot.py'), '--url', f'{url}?test&notitle&flat{extra}', '--out', out2, '--width', str(W), '--height', str(H)], check=True, capture_output=True)
    S2, worst2, where2, bad2 = compare(frame, Image.open(out2))
    print(f'{slug} against the runtime\'s own flat: SSIM {S2:.3f}, worst cell {100 * worst2:.1f}% at ({where2[0]:.2f}, {where2[1]:.2f}), cells over 8%: {bad2}')
    json.dump({'slug': slug, 'ssim': S, 'worst': worst, 'bad': bad, 'ssim_runtime_flat': S2, 'worst_runtime_flat': worst2, 'bad_runtime_flat': bad2},
              open(os.path.join(ROOT, 'shots', slug + '-standpoint.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
