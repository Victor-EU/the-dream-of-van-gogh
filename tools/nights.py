#!/usr/bin/env python3
"""His three nights, measured against each other (DESIGN 5.3 as D4.5 amends it, BUILD.md D4.5).

Until D4.5 our sky was the Starry Night's everywhere, because it is the only sky of his with a hand rich enough
to generate from. But his three nights are not one night. This reads each canvas's own sky region and writes
down what colour that night is and how deep his paint stands in it, so that our sky can keep his hand -- one
painter's -- and take its colour and its depth from the canvas nearest, exactly his at each standpoint.

It also writes the one colour the shore needs. His terrace's pavement is the only ground he painted as a surface
you stand on, so the shore's marks come from its hand; but the whole of that square is under a lamp, and it gets
*brighter* with distance (lum/sky 1.64 at 4 m and 2.80 at 90 m), so its paint cannot say what unlit town ground
is. The Starry Night's village can: it is ground at night away from any lamp. By D3's rule the shore takes his
hue and his brightness as a ratio against his own sky, and that ratio is applied to the night this piece stands
in and not to his paint.

    tools/nights.py
"""
import json, math, os, struct, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLUGS = ['starry', 'rhone', 'cafeterrace']
SKY = {'starry': ['sky', 'swirl'], 'rhone': ['sky'], 'cafeterrace': ['sky']}
LUM = np.array([0.2126, 0.7152, 0.0722])


PXCM = {}


def record(slug):
    b = open(os.path.join(ROOT, 'strokes', f'{slug}-canvas.bin'), 'rb').read()
    assert b[:4] == b'VGST', slug
    hdr, stride = struct.unpack_from('<H', b, 6)[0], struct.unpack_from('<H', b, 8)[0]
    n = struct.unpack_from('<I', b, 12)[0]
    lo, hi = struct.unpack_from('<ff', b, 52)
    PXCM[slug] = (struct.unpack_from('<II', b, 16), struct.unpack_from('<ff', b, 24))
    a = np.frombuffer(b, dtype=np.uint8, count=n * stride, offset=hdr).reshape(n, stride)
    pts = np.frombuffer(b, dtype='<u2', count=n * stride // 2, offset=hdr).reshape(n, stride // 2)[:, :6]
    pts = pts.astype(np.float64) / 65535 * (hi - lo) + lo
    return n, pts, (a[:, 12:15].astype(np.float64) / 255.0) ** 2.2   # sRGB in the record, linear here


def region(slug, laws):
    return np.frombuffer(open(os.path.join(ROOT, 'hand', f'{slug}-region.bin'), 'rb').read(), dtype=np.uint8), \
           list(laws['regions'].keys())


def elevation(slug, laws, n, p):
    """Every stroke's elevation above the horizontal, from his own eye: the canvas y through his focal length,
    turned by his pitch. A canvas is evidence about the band of sky it actually paints and about no other."""
    H = laws['_H']; W = laws['_W']; f = laws['_f']
    v = (p[:, 1] + p[:, 5]) / 2
    return np.degrees(np.arctan2((0.5 - v) * H, f)) + laws['eye']['pitch']


def main():
    out = {'_': __doc__.strip().split('\n\n')[1].replace('\n', ' '), 'nights': [], }
    for slug in SLUGS:
        laws = json.load(open(os.path.join(ROOT, 'depth', f'{slug}.json')))
        n, pts, rgb = record(slug)
        reg, names = region(slug, laws)
        px, cm = PXCM[slug]
        d = np.fromfile(os.path.join(ROOT, 'depth', f'{slug}-depth.bin'), dtype=np.float32).reshape(-1, 2)[:, 0]
        m = np.zeros(n, bool)
        for r in SKY[slug]:
            m |= reg == names.index(r)
        H = cm[1] / 100.0; W = H * px[0] / px[1]
        laws['_H'], laws['_W'] = H, W
        laws['_f'] = (W / 2) / math.tan(math.radians(laws['eye']['hfov']) / 2)
        el = elevation(slug, laws, n, pts)
        e = el[m]
        # his sky's colour band by band up the sky, four degrees at a time. The three canvases do not paint the
        # same sky: the Rhone's is 1.0 to 17.6 degrees and the terrace's 18.8 to 35.2, which do not touch, and
        # the Starry Night's spans both. So they cannot disagree about a colour -- they were never asked the
        # same question -- and all three say the same thing about the way a night changes going up: greener and
        # lighter at the horizon, and a purer and darker blue toward the top
        lo0, hi0 = float(e.min()), float(e.max())
        edges = np.arange(math.floor(lo0), math.ceil(hi0) + 4, 4.0)
        by_el = []
        for k in range(len(edges) - 1):
            kk = m & (el >= edges[k]) & (el < edges[k + 1])
            if kk.sum() < 25: continue
            cb = rgb[kk].mean(0)
            by_el.append({'el': round(float(0.5 * (edges[k] + edges[k + 1])), 2), 'n': int(kk.sum()),
                          'rgb': [round(float(x), 5) for x in cb], 'lum': round(float(cb @ LUM), 5)})
        c = rgb[m].mean(0)
        sd = rgb[m].std(0)
        law = laws['regions']['skyRange']['law']
        out['nights'].append({
            'slug': slug, 'regions': SKY[slug], 'n': int(m.sum()),
            'rgb': [round(float(v), 5) for v in c], 'sd': [round(float(v), 5) for v in sd],
            'lum': round(float(c @ LUM), 5),
            'hue': [round(float(v / c.max()), 4) for v in c],
            # where his sky paint actually stands, from his own eye, and the law it was put there by
            'depth_m': [round(float(d[m].min()), 1), round(float(d[m].max()), 1), round(float(d[m].mean()), 1)],
            'el_deg': [round(lo0, 2), round(hi0, 2), round(float(e.mean()), 2)],
            'by_el': by_el,
            'law': {'near': law['d1'], 'far': law['d0'],
                    'amp': laws['regions']['sky']['law'].get('amp', 0)},
            'eye': laws['eye'],
        })
    ref = out['nights'][0]
    for nt in out['nights']:
        nt['over_starry'] = [round(float(nt['rgb'][k] / ref['rgb'][k]), 4) for k in range(3)]
    # ---- the shore's colour: his unlit ground, as a ratio against his own sky (DESIGN 5.2's rule, D3 (2))
    laws = json.load(open(os.path.join(ROOT, 'depth', 'starry.json')))
    n, _pts, rgb = record('starry')
    reg, names = region('starry', laws)
    v = rgb[reg == names.index('village')]
    vc, vsd = v.mean(0), v.std(0)
    sky = np.array(ref['rgb'])
    out['shore'] = {
        '_': "The shore's colour. His village at Saint-Remy is the only ground of his painted at night away from "
             "a lamp; his terrace's pavement, whose hand the shore's marks come from, is lit by one and gets "
             "brighter with distance, so it cannot say this. Taken as D3 takes the water's: the hue exactly, and "
             "the brightness as a ratio against his own sky, to be applied to the sky this night stands under.",
        'of': 'starry/village', 'n': int((reg == names.index('village')).sum()),
        'rgb': [round(float(x), 5) for x in vc], 'sd': [round(float(x), 5) for x in vsd],
        'lum': round(float(vc @ LUM), 5),
        'hue': [round(float(x / vc.max()), 4) for x in vc],
        'over_sky': round(float((vc @ LUM) / (sky @ LUM)), 4),
        'hand': 'cafeterrace-pavement.json',
    }
    dest = os.path.join(ROOT, 'hand', 'nights.json')
    json.dump(out, open(dest, 'w'), indent=1)
    for nt in out['nights']:
        print(f"  {nt['slug']:12s} n={nt['n']:5d} rgb=({nt['rgb'][0]:.4f},{nt['rgb'][1]:.4f},{nt['rgb'][2]:.4f}) "
              f"lum={nt['lum']:.4f} hue=({nt['hue'][0]:.2f},{nt['hue'][1]:.2f},{nt['hue'][2]:.2f}) "
              f"depth {nt['depth_m'][0]:.0f}..{nt['depth_m'][1]:.0f} (law {nt['law']['near']:.0f}..{nt['law']['far']:.0f}) "
              f"el {nt['el_deg'][0]:5.1f}..{nt['el_deg'][1]:5.1f} in {len(nt['by_el'])} bands")
    sh = out['shore']
    print(f"  the shore: his village rgb=({sh['rgb'][0]:.4f},{sh['rgb'][1]:.4f},{sh['rgb'][2]:.4f}) "
          f"lum={sh['lum']:.4f}, which is {sh['over_sky']:.3f} of his own sky")
    print('wrote', dest)


if __name__ == '__main__':
    main()
