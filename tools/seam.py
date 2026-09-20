#!/usr/bin/env python3
"""The seam (BUILD.md D2, DESIGN 15.2): where his sky stops and ours goes on, is there a line?

His cone is a rectangle of directions from his standpoint. Ours begins exactly at its edge. This takes the frame
at three viewpoints that each put a stretch of that edge down the middle, crops 512 px across it, and reports the
mean colour of his half against ours -- which the plan pre-registers at within ten per cent -- with a strip at the
seam itself left out so that the boundary is not measured against itself.

The three viewpoints the plan asks for are chosen so that his side of the crop is sky: they walk along the top of
his cone, which is the one stretch of its edge with plain sky inside it. Two more are taken where his own
composition meets the edge -- his moon's band on the right, and the same edge from inside the sky -- and reported
apart, because there the number is about his painting and not about the seam: a generator drawn from his sky as a
whole cannot put a white wave or a moon at the edge because his hand put one there. The frame is taken at the pixel ratio the piece runs at on a good screen, so that 512 px is about sixteen
degrees, which is the scale over which his own paint stays correlated (hand/starry-sky.json says five). It also asks the runtime for the numbers
behind the picture (dream.seam): how many strokes lie in a band either side, what colour their paint is and how
long they are, in the air and as an angle from his eye.

The pictures are written to shots/<slug>-seam-<n>.png for looking at, which is the half of this test that no
number settles: the plan asks whether someone who was not told where the seam is can find it.

    tools/seam.py starry
"""
import argparse, json, math, os, struct, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ray(u, v, eye, W, H, f):
    x, y, z = (u - 0.5) * W, (0.5 - v) * H, -f
    l = math.sqrt(x * x + y * y + z * z); x, y, z = x / l, y / l, z / l
    cp, sp = math.cos(math.radians(eye['pitch'])), math.sin(math.radians(eye['pitch']))
    y2, z2 = y * cp - z * sp, y * sp + z * cp
    cy, sy = math.cos(math.radians(eye['yaw'])), math.sin(math.radians(eye['yaw']))
    # the piece turns yaw this way (src/explode.js, src/wind.js, tools/depth.py). This file was written when
    # every standpoint was at yaw 0, where both ways agree, and D4 fixed the four places that had it backwards
    # without reaching here: found in D4.5, and it only ever mattered once a canvas faced somewhere else
    return [x * cy - z2 * sy, y2, x * sy + z2 * cy]


def aim(frm, to):
    d = [to[i] - frm[i] for i in range(3)]
    l = math.hypot(*d)
    return math.degrees(math.atan2(d[0], -d[2])), math.degrees(math.asin(d[1] / l))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug', nargs='?', default='starry')
    ap.add_argument('--url', default='http://127.0.0.1:8712/?notitle&q=high')
    ap.add_argument('--width', type=int, default=1200)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--scale', type=float, default=2.0)
    ap.add_argument('--crop', type=int, default=512)
    ap.add_argument('--strip', type=int, default=38, help='pixels either side of the seam for the narrow comparison')
    ap.add_argument('--gap', type=int, default=10, help='pixels either side of the seam left out of both halves')
    a = ap.parse_args()
    laws = json.load(open(os.path.join(ROOT, 'depth', a.slug + '.json')))
    eye = laws['eye']
    # the canvas from its own record, so that this runs on any of the three and not only the one with a wind
    rb = open(os.path.join(ROOT, 'strokes', a.slug + '-canvas.bin'), 'rb').read()
    px = struct.unpack_from('<II', rb, 16); cm = struct.unpack_from('<ff', rb, 24)
    H = cm[1] / 100.0
    W = H * px[0] / px[1]
    f = (W / 2) / math.tan(math.radians(eye['hfov']) / 2)
    E = [eye['x'], eye['y'], eye['z']]
    half_u = math.degrees(math.atan((W / 2) / f)); half_v = math.degrees(math.atan((H / 2) / f))
    axis = ray(0.5, 0.5, eye, W, H, f)
    # a point on his right edge, at the depth his law gives that row, to aim at from off the standpoint
    v0 = 0.40
    L = laws['regions']['skyRange']['law']
    d0 = L['d0'] + (L['d1'] - L['d0']) * min(1, max(0, (v0 - L['v0']) / (L['v1'] - L['v0'])))
    r_edge = ray(1.0, v0, eye, W, H, f)
    P_edge = [E[i] + r_edge[i] * d0 for i in range(3)]
    off = [E[i] + axis[i] * 200 for i in range(3)]
    yaw3, pitch3 = aim(off, P_edge)
    pitch_v0 = eye['pitch'] + math.degrees(math.atan((0.5 - v0) * H / f))
    top = eye['pitch'] + half_v
    views = [
        ('top-left', E, eye['yaw'] - 17, top, 'y', True),
        ('top-middle', E, eye['yaw'], top, 'y', True),
        ('top-right', E, eye['yaw'] + 17, top, 'y', True),
        ('right-edge', E, eye['yaw'] + half_u, pitch_v0, 'x', False),
        ('from-within', off, yaw3, pitch3, 'x', False),
    ]
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': a.width, 'height': a.height}, device_scale_factor=a.scale)
        pg.goto(a.url)
        pg.wait_for_function('window.dream && window.dream.ready', timeout=120000)
        nums = pg.evaluate('dream.seam()')
        for (name, pos, yaw, pitch, axis_, sky_) in views:
            pg.evaluate(f'dream.go({{pos: {json.dumps([round(v, 2) for v in pos])}, yaw: {yaw:.3f}, pitch: {pitch:.3f}, speed: 0}}); dream.hold();')
            pg.evaluate('dream.wait(0.35)')
            dest = os.path.join(ROOT, 'shots', f'{a.slug}-seam-{name}.png')
            pg.screenshot(path=dest)
            im = np.asarray(Image.open(dest).convert('RGB')).astype(np.float64) / 255.0
            deg = a.crop / (a.height * a.scale) * 2 * math.degrees(math.atan(math.tan(math.radians(70 / 2)) / (a.width / a.height)))
            lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)
            h, w = lin.shape[:2]
            c = a.crop // 2
            cy, cx = h // 2, w // 2
            box = lin[cy - c:cy + c, cx - c:cx + c]
            g = a.gap
            lum = lambda c_: 0.2126 * c_[0] + 0.7152 * c_[1] + 0.0722 * c_[2]
            row = [name]
            # the whole crop, and then a strip either side of the line itself: the first is his composition
            # against our sky, the second is whether there is a line
            for (w_px, what) in ((c, 'crop'), (a.strip, 'strip')):
                lo = max(0, c - g - w_px)
                if axis_ == 'x':
                    his, ours = box[:, lo:c - g], box[:, c + g:c + g + w_px]
                else:
                    his, ours = box[c + g:c + g + w_px, :], box[lo:c - g, :]
                hm, om = his.reshape(-1, 3).mean(0), ours.reshape(-1, 3).mean(0)
                pct = [round(100 * (om[k] / max(hm[k], 1e-6) - 1), 1) for k in range(3)]
                row.append((what, hm, om, pct, round(100 * (lum(om) / lum(hm) - 1), 1),
                            deg * (w_px / c) if axis_ == 'y' else deg * (w_px / c)))
            row.append(sky_)
            out.append(row)
            for (what, hm, om, pct, br, dg) in row[1:3]:
                print(f'{name:12s} {what:5s} {dg:4.1f} deg  his {np.round(hm, 4)}  ours {np.round(om, 4)}'
                      f'  off {[f"{v:+.1f}" for v in pct]} %, in brightness {br:+.1f}%')
        b.close()
    print()
    print('the strokes in a band of 3 degrees either side (dream.seam):')
    print(f'  his   {nums["his"]["n"]:5d}  rgb {nums["his"]["rgb"]}  {nums["his"]["ang_mrad"]} mrad  {nums["his"]["len_m"]} m')
    print(f'  ours  {nums["ours"]["n"]:5d}  rgb {nums["ours"]["rgb"]}  {nums["ours"]["ang_mrad"]} mrad  {nums["ours"]["len_m"]} m')
    print(f'  ours off his: colour {nums["off_pct"]["rgb"]} %, angle {nums["off_pct"]["ang"]} %, length in the air {nums["off_pct"]["len"]} %')
    for what, i in (('crop', 1), ('the strip at the line', 2)):
        w1 = max(abs(v) for row in out if row[3] for v in row[i][3])
        w2 = max(abs(v) for row in out if not row[3] for v in row[i][3])
        print(f'{what:22s} worst channel: {w1:.1f}% over the three sky-to-sky viewpoints (pre-registered: within 10%),'
              f' {w2:.1f}% where his composition meets the edge')


if __name__ == '__main__':
    main()
