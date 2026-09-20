#!/usr/bin/env python3
"""Does a column lie under its light, from every eye? (BUILD.md D3, the first exit criterion.)

A reflection that does not move with the eye is a decal. This puts the same light in the frame from several
places -- low over the water, high above it, off to one side, close and far -- and measures, in the rendered
frame and not in the arithmetic that made it:

    where the light is on the screen, and where its column is: if the column is under its light, the two stand
    at the same bearing and the column is below
    how long the column is, in degrees, which is what changes with the eye and is the whole of the difference
    between a reflection and a decal
    and, against it, where the column would have stood had it been painted on the water once and left there

Two frames a viewpoint, one with nothing but the lights and one with nothing but the reflections, so that each
can be found without the sky in the way (?only=).

    tools/reflect.py --light 20
"""
import argparse, json, math, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright

# a person's: four places to stand, chosen to be the four that could break it
EYES = [('low over the water', [0, 3, 0]), ('at his standpoint', [0, 40, 0]),
        ('high above it', [0, 260, 0]), ('off to one side', [330, 70, 240])]


def blob(img, bg, grow=9):
    """Where the column is in the frame: the frame with it against the frame without it, so that what is measured
    is the paint and not the night behind it. The lit pixels are joined up -- a column is a stack of separate
    marks -- and the heaviest piece of them is taken."""
    a = np.asarray(img.convert('RGB')).astype(float) / 255.0
    b = np.asarray(bg.convert('RGB')).astype(float) / 255.0
    d = np.abs(a - b).sum(-1)
    lum = d
    m = d > 0.035          # anything the column changed at all, so that its faint far end is not thrown away
    if m.sum() < 8: return None
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=grow))
    if n == 0: return None
    lab = lab * m
    w = ndimage.sum(lum * m, lab, range(1, n + 1))
    k = int(np.argmax(w)) + 1
    m = lab == k
    ys, xs = np.nonzero(m)
    q = lum[ys, xs]
    return dict(x=float((xs * q).sum() / q.sum()), y=float((ys * q).sum() / q.sum()),
                y0=int(ys.min()), y1=int(ys.max()), x0=int(xs.min()), x1=int(xs.max()), n=int(m.sum()),
                pieces=int(n))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--light', type=int, default=20)
    ap.add_argument('--url', default='http://127.0.0.1:8712/?notitle')
    ap.add_argument('--width', type=int, default=900)
    ap.add_argument('--height', type=int, default=700)
    ap.add_argument('--hfov', type=float, default=70)
    ap.add_argument('--keep', default=os.path.join(ROOT, 'shots'))
    a = ap.parse_args()
    ppd = None
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': a.width, 'height': a.height})
        pg.goto(a.url)
        pg.wait_for_function('window.dream && window.dream.ready', timeout=60000)
        # the clock stops, so that two frames differ only by the column; and parting is off, because a mark five
        # metres from the eye is pushed aside by DESIGN 6.5 and this test is about where it was laid, not that
        pg.evaluate('dream.freeze(3); dream.part(0)')
        vfov = 2 * math.degrees(math.atan(math.tan(math.radians(a.hfov) / 2) * a.height / a.width))
        ppd = a.height / vfov
        first = None
        for name, eye in EYES:
            g = pg.evaluate(f'dream.column({a.light}, {json.dumps(eye)})')
            if not g: print(name, 'no column'); continue
            if first is None: first = g
            # look at the middle of where the column is laid, so that both it and its light are in one frame
            mid = g['midP']
            dx, dz = mid[0] - eye[0], mid[2] - eye[2]
            yaw = math.degrees(math.atan2(dx, -dz))
            # look at the middle of the column by elevation and open the frame wide enough to hold all of it:
            # from three metres over the water a column runs more than half a right angle down the sky
            eln = -math.degrees(math.atan2(eye[1], g['near_m']))
            elf = -math.degrees(math.atan2(eye[1], g['far_m']))
            pitch = 0.5 * (eln + elf)
            vf = min(150.0, max(40.0, 1.35 * abs(eln - elf) + 12))
            hf = 2 * math.degrees(math.atan(math.tan(math.radians(vf) / 2) * a.width / a.height))
            lp = g['light']['at']
            # aim at the middle of the column, not between it and its light: what is being measured is where the
            # column is, and the light's own bearing is arithmetic that needs no picture
            pg.evaluate(f'dream.hfov({hf}); dream.go({{pos: {json.dumps(eye)}, yaw: {yaw}, pitch: {pitch}, speed: 0}}); dream.hold()')
            # this one column, with nothing else drawn, so that what the frame shows is only what is being asked
            pg.evaluate(f'dream.layers({{only: "reflections"}}); dream.onlyLight({a.light})')
            f = os.path.join(a.keep, f'd3-reflect-{name.split()[0]}.png')
            pg.wait_for_timeout(300)
            pg.screenshot(path=f)
            pg.evaluate('dream.onlyLight(999999)')
            pg.wait_for_timeout(300)
            fb = os.path.join(a.keep, f'd3-reflect-{name.split()[0]}-without.png')
            pg.screenshot(path=fb)
            near = pg.evaluate(f'dream.project({json.dumps(g["nearP"])})')
            far = pg.evaluate(f'dream.project({json.dumps(g["farP"])})')
            pg.evaluate('dream.onlyLight(-1); dream.layers({strokes: true})')
            H = a.height
            C = blob(Image.open(f), Image.open(fb))
            if not C:
                rows.append(dict(eye=name, at=eye, ok=False, why='column'))
                print(f'{name:20s} the column is not in the frame; it should be drawn between '
                      f'{[round(v) for v in near[:2]]} and {[round(v) for v in far[:2]]} of {a.width}x{a.height}')
                continue
            # the bearing the column was actually drawn at, read back out of the pixels it lit
            got = pg.evaluate(f'dream.unproject([{C["x"]}, {C["y"]}])')
            top = pg.evaluate(f'dream.unproject([{C["x"]}, {C["y0"]}])')
            bot = pg.evaluate(f'dream.unproject([{C["x"]}, {C["y1"]}])')
            want = math.degrees(math.atan2(lp[0] - eye[0], -(lp[2] - eye[2])))
            L = dict(x=0.0, y=0.0, az=want)
            off = (got['az'] - want + 540) % 360 - 180
            length = abs(top['el'] - bot['el'])
            rows.append(dict(eye=name, at=eye, light_az=round(want, 3), column_az=got['az'], pieces=C['pieces'],
                             drawn_px=[[round(near[0], 1), round(near[1], 1)], [round(far[0], 1), round(far[1], 1)]],
                             column_px=[round(C['x'], 1), round(C['y'], 1)], lit_px=C['n'], hfov=round(hf, 1),
                             under_by_deg=round(off, 3), below=bool(got['el'] < 0),
                             el_deg=[round(top['el'], 2), round(bot['el'], 2)],
                             column_deg=round(length, 2), from_arith_deg=g['angLen_deg'],
                             laid_m=g['laid_m'], mid=g['midP'], marks=g['marks']))
            print(f'{name:20s} the light lies {want:+8.3f} deg round, its column {got["az"]:+8.3f}: under it by '
                  f'{off:+.3f} deg, {"below" if got["el"] < 0 else "ABOVE"} the horizon at {got["el"]:+.1f}; '
                  f'{length:5.2f} deg of sky tall ({g["angLen_deg"]} by the law), {C["n"]} lit pixels')
        b.close()
    ok = [r for r in rows if r.get('under_by_deg') is not None]
    if ok:
        worst = max(abs(r['under_by_deg']) for r in ok)
        mids = [r['mid'] for r in ok]
        travel = max(math.dist(m, mids[0]) for m in mids)
        print(f'\nthe worst a column stands off the bearing of its light: {worst:.3f} degrees, over {len(ok)} eyes')
        print(f'the column is {min(r["from_arith_deg"] for r in ok):.2f} to {max(r["from_arith_deg"] for r in ok):.2f} '
              f'degrees long over those eyes, and its middle moves {travel:.0f} m across the water; '
              f'a decal would move none of it')
    json.dump(rows, open(os.path.join(ROOT, 'shots', 'd3-reflect.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
