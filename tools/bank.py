#!/usr/bin/env python3
"""The bank, seen (DESIGN 5.2 as D4.6 amends it), pre-registered.

From the air the world is one world only if you can see where the river ends. This stands the eye over the
river, looks across a bank, and walks a line of world points from the shore out into the water -- asking the
runtime itself where each one falls on the screen (`dream.project`) and reading the frame there. What it
prints is the profile of the floor's own brightness across the bank, the mean either side, the step between
them as a share of the brighter, and where in metres the step actually falls.

Nothing here is modelled: the frame is the frame a person sees, post and all, and the only arithmetic is sRGB
back to linear and the luminance of a colour.

    tools/bank.py --out shots/d46-bank.png
    tools/bank.py --bank far --pitch -25
"""
import argparse, json, os, sys, tempfile
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LUM = np.array([0.2126, 0.7152, 0.0722])


def lin(a):
    a = a.astype(np.float64) / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8712/?notitle')
    ap.add_argument('--out', help='keep the frame here')
    ap.add_argument('--bank', default='near', choices=['near', 'far'])
    ap.add_argument('--up', type=float, default=100.0, help='metres over the water')
    ap.add_argument('--out-m', type=float, default=120.0, help='metres out from the bank the eye stands')
    ap.add_argument('--z', type=float, default=400.0)
    ap.add_argument('--pitch', type=float, default=-32.0)
    ap.add_argument('--hfov', type=float, default=70.0)
    ap.add_argument('--span', type=float, default=45.0, help='metres either side of the bank')
    ap.add_argument('--step', type=float, default=2.5)
    ap.add_argument('--along', type=float, default=150.0, help='metres along the bank sampled either way')
    ap.add_argument('--near-m', type=float, default=8.0, help='metres from the bank the two means start')
    ap.add_argument('--radius', type=int, default=6, help='pixels sampled round each point')
    ap.add_argument('--width', type=int, default=1200)
    ap.add_argument('--height', type=int, default=900)
    a = ap.parse_args()
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': a.width, 'height': a.height})
        pg.set_default_timeout(180000)
        pg.goto(a.url)
        pg.wait_for_function('window.dream && window.dream.ready', timeout=300000)
        fl = pg.evaluate('dream.floorOf()')
        B, S = fl['bank_m'], fl['shore_m']
        # the eye stands out over the water from the bank it is looking at, and looks back across it
        if a.bank == 'near':
            x0, yaw = B[0], 270.0
            eye = [B[0] + a.out_m, a.up, a.z]
        else:
            x0, yaw = B[1], 90.0
            eye = [B[1] - a.out_m, a.up, a.z]
        pg.evaluate(f'dream.go({json.dumps({"pos": eye, "yaw": yaw, "pitch": a.pitch, "speed": 0})})')
        pg.evaluate('dream.wait(0.5)')
        xs = np.arange(-a.span, a.span + 1e-9, a.step)
        zs = np.arange(-a.along, a.along + 1e-9, a.along / 12)
        pts = []
        for d in xs:                                   # d < 0 is the land side of this bank, d > 0 the water
            x = x0 + (d if a.bank == 'near' else -d)
            y = (0.0 if B[0] < x < B[1] else S) - 0.6
            pts.append([[x, y, a.z + dz] for dz in zs])
        px = pg.evaluate('(P => P.map(r => r.map(q => dream.project(q))))(' + json.dumps(pts) + ')')
        tmp = a.out or os.path.join(tempfile.gettempdir(), 'bank.png')
        pg.screenshot(path=tmp)
        b.close()
    im = lin(np.asarray(Image.open(tmp).convert('RGB')))
    H, W, _ = im.shape
    L = im @ LUM
    prof, seen, hid = [], [], 0
    for row in px:
        v = []
        for q in row:
            i, j = int(round(q[0])), int(round(q[1]))
            if not (a.radius <= i < W - a.radius and a.radius <= j < H - a.radius and q[2] < 1.0): continue
            v.append(float(np.median(L[j - a.radius:j + a.radius + 1, i - a.radius:i + a.radius + 1])))
        seen.append(len(v))
        if not v: prof.append(None); continue
        # the floor's own brightness, under whatever of ours happens to hang in front of it: the low quartile
        # of many samples along the bank, which a mark drifting across a few of them cannot move
        hid += sum(1 for c in v if c > 4 * np.percentile(v, 20))
        prof.append(float(np.percentile(v, 20)))
    srgb = lambda c: round(255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055), 1)
    # a sample half again brighter than the floor is something of ours lying on the floor -- a mark, a
    # reflection, a mote that survived the quartile -- and not the floor. It is capped, not dropped
    cap = 1.5 * float(np.median([c for c in prof if c is not None]))
    prof = [None if c is None else min(c, cap) for c in prof]
    land = [v for d, v in zip(xs, prof) if v is not None and -a.span <= d <= -a.near_m]
    water = [v for d, v in zip(xs, prof) if v is not None and a.near_m <= d <= a.span]
    ml, mw = float(np.median(land)), float(np.median(water))
    step = abs(mw - ml) / max(mw, ml, 1e-12)
    # and where the floor actually changes: the one place to cut the profile in two that leaves the biggest
    # difference between the two halves. Nothing tells it where the bank is; it is asked, and it answers
    best, at = 0.0, None
    v = [c for c in prof if c is not None]
    ix = [d for d, c in zip(xs, prof) if c is not None]
    for k in range(4, len(v) - 4):
        a1, a2 = float(np.mean(v[:k])), float(np.mean(v[k:]))   # noqa: the profile is already capped
        j = abs(a2 - a1) / max(a1, a2, 1e-12)
        if j > best: best, at = j, float((ix[k - 1] + ix[k]) / 2)
    print(json.dumps({'bank': a.bank, 'at_m': x0, 'eye': eye, 'yaw': yaw, 'pitch': a.pitch,
                      'land_lum': round(ml, 6), 'water_lum': round(mw, 6),
                      'land_8bit': srgb(ml), 'water_8bit': srgb(mw),
                      'step': round(step, 4), 'levels': round(srgb(mw) - srgb(ml), 1), 'step_at_m': at, 'step_off_m': None if at is None else round(abs(at), 2),
                      'samples': int(np.median(seen)), 'covered': round(hid / max(1, sum(seen)), 4),
                      'profile': [None if v is None else round(v, 6) for v in prof],
                      'x_m': [round(float(v), 1) for v in xs]}))
    if a.out: print('wrote', a.out, file=sys.stderr)


main()
