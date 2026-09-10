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
    # hdr_len is read, never assumed: the header grew from 192 to 256 at
    # version 2 and this file did not have to know
    cw, ch = struct.unpack_from("<II", b, 16)
    cwcm, chcm, ppcm = struct.unpack_from("<fff", b, 24)
    tile = struct.unpack_from("<IIII", b, 36)
    lo, hi = struct.unpack_from("<ff", b, 52)
    k, = struct.unpack_from("<f", b, 60)
    hmm, = struct.unpack_from("<f", b, 64)
    under_ds = struct.unpack_from("<H", b, 70)[0] if ver >= 2 else 0
    profile = bytes(b[168:192]).split(b"\x00")[0].decode("utf-8", "replace") if ver >= 2 else ""
    r = b[hdr:hdr + n * STRIDE].reshape(n, STRIDE)
    p = r[:, 0:12].copy().view("<u2").reshape(n, 3, 2).astype(np.float32)
    p = p / 65535.0 * (hi - lo) + lo
    return dict(n=n, cw=cw, ch=ch, cm=(cwcm, chcm), ppcm=ppcm, tile=tile,
                ver=ver, under_ds=under_ds, profile=profile,
                p=p, rgb=r[:, 12:15], width=r[:, 15].astype(np.float32) / 255.0 * k,
                height=r[:, 16].astype(np.float32) / 255.0, act=r[:, 17],
                flags=r[:, 18], hmm=hmm,
                order=r[:, 20:22].copy().view("<u2").ravel().astype(np.float32) / 65535.0,
                depth=r[:, 22:24].copy().view("<f2").ravel().astype(np.float32))


def render(d, px, tau=1.0, xray=False, under=None):
    tx, ty, tw, th = d["tile"]
    if tw == 0:
        tx, ty, tw, th = 0, 0, d["cw"], d["ch"]
    W = px
    H = max(1, int(round(px * th / tw)))
    sc = W / tw
    img = np.zeros((H, W, 3), np.float32)
    if under is not None:
        # the ground the strokes lie on, from the underlayer M0b extracts.
        # Compositing over it rather than over a flat tone is what makes this
        # the same image the runtime draws -- which is the whole point of the
        # hook, and the reason a wrong ribbon winding showed up as a
        # disagreement between the two rather than as merely bad art.
        u = np.asarray(under, np.float32) / 255.0
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        sy = (yy / sc + ty) * u.shape[0] / d["ch"]
        sx = (xx / sc + tx) * u.shape[1] / d["cw"]
        yi = np.clip(sy.astype(np.int32), 0, u.shape[0] - 1)
        xi = np.clip(sx.astype(np.int32), 0, u.shape[1] - 1)
        img[:] = u[yi, xi]
    else:
        img[:] = np.array([0.55, 0.50, 0.41], np.float32)
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
        # antialias only. An earlier version feathered by 35% of the
        # half-width, which on a 105 px stroke at 1:1 is an 18 px blur on
        # each edge -- the reconstruction looked like smeared blobs and the
        # blur was entirely this line, not the data it was drawing.
        a = np.clip((wpx - dist) / 1.2, 0, 1)
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
    up = os.path.splitext(a.blob)[0] + "-under.png"
    under = np.asarray(Image.open(up)) if os.path.exists(up) else None
    img, cov = render(d, a.px, a.tau, a.xray, under)
    out = a.out or os.path.splitext(a.blob)[0] + ("-xray" if a.xray else "-flat") + ".png"
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
    print(f"{d['n']} strokes, tau {a.tau:.2f}, covered {cov*100:.1f}%"
          f"{'' if under is not None else '  (no underlayer, flat ground)'}  -> {out}")


if __name__ == "__main__":
    main()
