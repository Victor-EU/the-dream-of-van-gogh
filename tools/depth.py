#!/usr/bin/env python3
"""Depth by region, authored, declared: DESIGN.md 4.3.

A painting is a set of rays from one eye. The record gives every stroke its place on the canvas, and with the
standpoint's field of view that is its ray; what it does not give is how far down the ray the stroke stands. This
tool reads a region mask a person painted over the flat rendering (depth/<slug>-mask.png), a law per region a
person typed (depth/<slug>.json), and writes one distance per stroke to depth/<slug>-depth.bin, in record order,
as float32 pairs: the distance in metres along the stroke's own ray, and how much the stroke shines. Nothing here
is measured. The runtime's caption says so, and the standpoint test (tools/standpoint.py) is the one check: from
his eye the frame must still be the painting.

The laws:

    const    d
    plane    the ground or the water: d = h / sin(angle below the horizontal), h the eye's height above it.
             D4 lets it be a ceiling too: an awning three and a half metres up is the same law read upward,
             which is what puts a cafe's canopy at four metres over your head and seventeen at its far end
    wall     a vertical plane, which is what a street is two of: d = c / (n . r) for a ray r and a horizontal
             unit normal n at bearing `n_deg` from the canvas's own forward, c metres from the eye along it
    range    linear in v between (v0, d0) and (v1, d1), clamped: a sky that is far at the hills and near overhead
    rel      k times another region's law at the same ray: a star a little nearer than the sky round it
    relief   another region's law plus amp times (order or brightness, from -1 to 1): a front and a back
    funnel   another region's law, receding by amp toward each of a list of centres on the canvas: an eddy
             is a tunnel that goes away from you

and two knobs on every region: `noise`, a fraction of jitter so that neighbours are not exactly coplanar, and
`shine`, the emissive weight of its strokes. `windows` on a region marks its small warm bright strokes as lit.
`orderNear` on the file puts a later stroke a little nearer than an earlier one, so that from the standpoint the
paint still layers the way he layered it.

    tools/depth.py starry
"""
import json, math, os, struct, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_record(path):
    b = open(path, 'rb').read()
    magic, ver, hdr, stride, flags, n = struct.unpack_from('<4sHHHHI', b, 0)
    assert magic == b'VGST' and stride == 24, (magic, stride)
    cw, ch = struct.unpack_from('<II', b, 16)
    wcm, hcm, ppc = struct.unpack_from('<fff', b, 24)
    lo, hi = struct.unpack_from('<ff', b, 52)
    wk = struct.unpack_from('<f', b, 60)[0]
    hmm = struct.unpack_from('<f', b, 64)[0]
    ck = struct.unpack_from('<f', b, 448)[0] if hdr >= 452 else 0.0
    rec = np.frombuffer(b, np.uint8, n * stride, hdr).reshape(n, stride)
    p = rec[:, :12].copy().view('<u2').reshape(n, 3, 2).astype(np.float64) / 65535.0 * (hi - lo) + lo
    rgb = rec[:, 12:15].astype(np.float64) / 255.0
    w = rec[:, 15].astype(np.float64) / 255.0 * wk
    h = rec[:, 16].astype(np.float64) / 255.0
    curl = rec[:, 19].astype(np.float64) / 255.0 * ck
    order = rec[:, 20:22].copy().view('<u2').reshape(n).astype(np.float64) / 65535.0
    return dict(n=n, p=p, rgb=rgb, w=w, h=h, curl=curl, order=order, cm=(wcm, hcm), px=(cw, ch), height_mm=hmm)


def rays(p_mid, eye, cm, px):
    """Direction of each stroke's ray in the world, from the eye's field of view; y up, the eye looks down -z at yaw 0.
    The canvas is the holder's height by the scan's aspect, as the sibling's sizes.js has it."""
    H = cm[1] / 100.0; W = H * px[0] / px[1]
    f = (W / 2) / math.tan(math.radians(eye['hfov']) / 2)
    x = (p_mid[:, 0] - 0.5) * W; y = (0.5 - p_mid[:, 1]) * H; z = np.full_like(x, -f)
    d = np.stack([x, y, z], 1); d /= np.linalg.norm(d, axis=1, keepdims=True)
    cp, sp = math.cos(math.radians(eye['pitch'])), math.sin(math.radians(eye['pitch']))
    y2 = d[:, 1] * cp - d[:, 2] * sp; z2 = d[:, 1] * sp + d[:, 2] * cp
    d = np.stack([d[:, 0], y2, z2], 1)
    cy, sy = math.cos(math.radians(eye['yaw'])), math.sin(math.radians(eye['yaw']))
    x3 = d[:, 0] * cy - d[:, 2] * sy; z3 = d[:, 0] * sy + d[:, 2] * cy
    return np.stack([x3, d[:, 1], z3], 1), f


def hash01(i):
    x = (np.asarray(i, np.uint64) * np.uint64(2654435761)) & np.uint64(0xFFFFFFFF)
    x = (x ^ (x >> np.uint64(15))) * np.uint64(2246822519) & np.uint64(0xFFFFFFFF)
    return ((x ^ (x >> np.uint64(13))) & np.uint64(0xFFFFFF)).astype(np.float64) / float(0xFFFFFF)


def main():
    slug = sys.argv[1]
    laws = json.load(open(os.path.join(ROOT, 'depth', slug + '.json')))
    R = read_record(os.path.join(ROOT, 'strokes', slug + '-canvas.bin'))
    mask = np.asarray(Image.open(os.path.join(ROOT, 'depth', slug + '-mask.png')).convert('RGB'))
    n = R['n']
    mid = 0.25 * R['p'][:, 0] + 0.5 * R['p'][:, 1] + 0.25 * R['p'][:, 2]
    mh, mw = mask.shape[:2]
    px = np.clip((mid[:, 0] * mw).astype(int), 0, mw - 1); py = np.clip((mid[:, 1] * mh).astype(int), 0, mh - 1)
    col = mask[py, px].astype(int)
    names = list(laws['regions'].keys())
    keys = np.array([laws['regions'][k]['key'] for k in names])
    region = np.argmin(((col[:, None, :] - keys[None, :, :]) ** 2).sum(-1), axis=1)

    eye = laws['eye']
    d, f = rays(mid, eye, R['cm'], R['px'])
    el = np.arcsin(np.clip(d[:, 1], -1, 1))
    lum = 0.2126 * R['rgb'][:, 0] + 0.7152 * R['rgb'][:, 1] + 0.0722 * R['rgb'][:, 2]
    yellow = np.clip((R['rgb'][:, 0] + R['rgb'][:, 1]) * 0.5 - R['rgb'][:, 2], 0, 1)
    far = laws.get('far', 3000.0)

    cache = {}

    def law_of(name):
        if name in cache: return cache[name]
        L = laws['regions'][name]['law']
        t = L['type']
        if t == 'const':
            out = np.full(n, float(L['d']))
        elif t == 'plane':
            h = eye['y'] - L.get('y', 0.0)
            if h >= 0:                                       # a floor: the rays that go down meet it
                ok = el < math.radians(-0.3)
                out = np.where(ok, h / np.sin(np.clip(-el, 1e-4, None)), far)
            else:                                            # a ceiling: the rays that go up
                ok = el > math.radians(0.3)
                out = np.where(ok, -h / np.sin(np.clip(el, 1e-4, None)), far)
            out = np.minimum(out, L.get('far', far))
        elif t == 'wall':
            b = math.radians(float(L['n_deg']) + eye['yaw'])
            nx, nz = math.sin(b), -math.cos(b)               # the eye's forward at yaw is (-sin, 0, -cos)
            dn = d[:, 0] * nx + d[:, 2] * nz
            out = np.where(dn > 1e-3, float(L['c']) / np.maximum(dn, 1e-3), far)
            out = np.minimum(out, L.get('far', far))
        elif t == 'range':
            t01 = np.clip((mid[:, 1] - L['v0']) / (L['v1'] - L['v0']), 0, 1)
            out = L['d0'] + (L['d1'] - L['d0']) * t01
        elif t == 'rel':
            out = law_of(L['base']) * float(L['k'])
        elif t == 'relief':
            by = R['order'] if L.get('by', 'order') == 'order' else lum
            out = law_of(L['base']) - float(L['amp']) * (by - 0.5) * 2.0
        elif t == 'funnel':
            k = np.zeros(n)
            for (cu, cv, ru, rv) in L['centres']:
                r = np.sqrt(((mid[:, 0] - cu) / ru) ** 2 + ((mid[:, 1] - cv) / rv) ** 2)
                k = np.maximum(k, np.clip(1.0 - r, 0, 1) ** 2)
            out = law_of(L['base']) + float(L['amp']) * k
        else:
            raise SystemExit('unknown law ' + t)
        cache[name] = out
        return out

    depth = np.zeros(n); shine = np.zeros(n)
    idx = np.arange(n)
    for ri, name in enumerate(names):
        m = region == ri
        if not m.any(): continue
        reg = laws['regions'][name]
        dd = law_of(name)[m]
        noise = float(reg.get('noise', laws.get('noise', 0.0)))
        dd = dd * (1.0 + (hash01(idx[m]) - 0.5) * 2.0 * noise)
        dd = np.clip(dd, float(reg.get('near', 0.5)), float(reg.get('far', far * 1.5)))
        depth[m] = dd
        shine[m] = float(reg.get('shine', 0.0))
        if reg.get('windows'):
            wv = (lum[m] > reg['windows'].get('lum', 0.45)) & (yellow[m] > reg['windows'].get('yellow', 0.15))
            s = shine[m]; s[wv] = float(reg['windows'].get('shine', 1.5)); shine[m] = s
    on = float(laws.get('orderNear', 0.0))
    depth *= (1.0 - on * R['order'])
    # nothing stands under the floor: a ray below the horizontal stops where the world's floor is, whatever its
    # law said. Until D4.5 that floor was the water at height zero for every canvas, because the world had no
    # land in it; now it is the shore under this canvas's own standpoint, and `water` is kept as the old name
    water = float(laws.get('floor', laws.get('water', 0.0)))
    under = el < math.radians(-0.05)
    depth = np.where(under, np.minimum(depth, (eye['y'] - water + 0.4) / np.sin(np.clip(-el, 1e-4, None))), depth)
    depth = np.clip(depth, 0.5, far * 1.5)

    dest = os.path.join(ROOT, 'depth', slug + '-depth.bin')
    np.stack([depth, shine], 1).astype('<f4').tofile(dest)
    print(f'{slug}: {n} strokes, f = {100 * f:.1f} cm at hfov {eye["hfov"]}, eye {eye["y"]} m, pitch {eye["pitch"]}')
    for ri, name in enumerate(names):
        m = region == ri
        if not m.any(): print(f'  {name:9s}      0'); continue
        dd = depth[m]
        print(f'  {name:9s} {m.sum():6d}  d {dd.min():7.1f} {np.median(dd):7.1f} {dd.max():7.1f}   shine {shine[m].mean():.2f}')
    print('wrote', dest)


if __name__ == '__main__':
    main()
