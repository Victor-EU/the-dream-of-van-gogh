#!/usr/bin/env python3
"""Render a packed blob orthographically, flat, at the canvas's aspect.

The point of rendering from the .bin rather than from the extractor's own state
is that it exercises the packed record: a colour space applied twice, a flipped
axis, an off-by-one in the order fraction, a width that lost its k, all show up
here instead of being found later by staring at the world. BUILD.md's `?flat`
hook makes the runtime produce this same image from the same bytes.

    tools/flat.py strokes/m0a/reaper-gate.bin [--px 1200] [--tau 0.5]
"""
import argparse, os, struct
import numpy as np
from PIL import Image

STRIDE = 24


def read(path):
    b = np.fromfile(path, np.uint8)
    magic, ver, hdr, stride, flags, n = struct.unpack_from("<4sHHHHI", b, 0)
    assert magic == b"VGST" and stride == STRIDE, "not a stroke blob"
    cw, ch = struct.unpack_from("<II", b, 16)
    cwcm, chcm, ppcm = struct.unpack_from("<fff", b, 24)
    tile = struct.unpack_from("<IIII", b, 36)
    lo, hi = struct.unpack_from("<ff", b, 52)
    k, = struct.unpack_from("<f", b, 60)
    hmm, = struct.unpack_from("<f", b, 64)
    r = b[hdr:hdr + n * STRIDE].reshape(n, STRIDE)
    p = r[:, 0:12].copy().view("<u2").reshape(n, 3, 2).astype(np.float32)
    p = p / 65535.0 * (hi - lo) + lo
    return dict(n=n, cw=cw, ch=ch, cm=(cwcm, chcm), ppcm=ppcm, tile=tile,
                p=p, rgb=r[:, 12:15], width=r[:, 15].astype(np.float32) / 255.0 * k,
                height=r[:, 16].astype(np.float32) / 255.0, act=r[:, 17],
                flags=r[:, 18], hmm=hmm,
                order=r[:, 20:22].copy().view("<u2").ravel().astype(np.float32) / 65535.0,
                depth=r[:, 22:24].copy().view("<f2").ravel().astype(np.float32))


def render(d, px, tau=1.0, xray=False):
    tx, ty, tw, th = d["tile"]
    if tw == 0:
        tx, ty, tw, th = 0, 0, d["cw"], d["ch"]
    W = px
    H = max(1, int(round(px * th / tw)))
    sc = W / tw
    img = np.zeros((H, W, 3), np.float32)
    img[:] = np.array([0.55, 0.50, 0.41], np.float32)      # bare ground; the
    # real residual underlayer is M0b's job, this is a flat stand-in for it
    cov = np.zeros((H, W), np.float32)

    short = min(d["cw"], d["ch"])
    seq = np.argsort(d["order"])                            # painter's algorithm
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for i in seq:
        if d["order"][i] > tau:
            continue
        p = d["p"][i] * [d["cw"], d["ch"]] - [tx, ty]
        p = p * sc
        wpx = max(1.0, d["width"][i] * short * sc * (0.16 if xray else 0.5))
        t = np.linspace(0, 1, 48, dtype=np.float32)[:, None]
        c = (1 - t) ** 2 * p[0] + 2 * t * (1 - t) * p[1] + t ** 2 * p[2]
        x0 = max(0, int(c[:, 0].min() - wpx) - 1)
        x1 = min(W, int(c[:, 0].max() + wpx) + 2)
        y0 = max(0, int(c[:, 1].min() - wpx) - 1)
        y1 = min(H, int(c[:, 1].max() + wpx) + 2)
        if x1 <= x0 or y1 <= y0:
            continue
        gx = xx[y0:y1, x0:x1, None]
        gy = yy[y0:y1, x0:x1, None]
        dist = np.sqrt((gx - c[None, None, :, 0]) ** 2 +
                       (gy - c[None, None, :, 1]) ** 2).min(-1)
        a = np.clip((wpx - dist) / max(0.8, wpx * 0.35), 0, 1)
        col = d["rgb"][i].astype(np.float32) / 255.0
        if xray:
            col = np.array([1.0, 0.1, 0.05], np.float32)
        sub = img[y0:y1, x0:x1]
        img[y0:y1, x0:x1] = sub * (1 - a[..., None]) + col * a[..., None]
        cov[y0:y1, x0:x1] = np.maximum(cov[y0:y1, x0:x1], a)
    return img, float((cov > 0.5).mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("blob")
    ap.add_argument("--px", type=int, default=1200)
    ap.add_argument("--tau", type=float, default=1.0)
    ap.add_argument("--xray", action="store_true")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    d = read(a.blob)
    img, cov = render(d, a.px, a.tau, a.xray)
    out = a.out or os.path.splitext(a.blob)[0] + ("-xray" if a.xray else "-flat") + ".png"
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
    print(f"{d['n']} strokes, tau {a.tau:.2f}, covered {cov*100:.1f}%  -> {out}")


if __name__ == "__main__":
    main()
