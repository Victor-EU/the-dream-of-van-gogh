#!/usr/bin/env python3
"""Pick the two 1:1 regions a params file names, by measurement.

A params file carries a handful of named rectangles. They tune nothing in a
whole-canvas build -- they exist so that a person can look at one 3072 px square
of a canvas at 1:1 and at the strokes fitted to it, which is how every wrong
number in this pipeline has actually been found.

M0a picked the Reaper's by looking at the canvas. Nineteen more canvases arrived
at M6 and picking nineteen rectangles by eye is nineteen chances to pick a
flattering one, so they are picked by the same statistic the extractor lives or
dies on: band-pass energy at stroke scale, the thing DESIGN 4.1 says the strokes
must carry rather than the residual.

  paint  the window that carries the most of it -- the most worked passage
  thin   the least, among windows that are still canvas rather than surround

Two rather than one because the pair is the test: an extractor tuned until the
densest passage looks right is an extractor that fragments everywhere else, and
the two regions disagreeing is the signal M0a's three named regions were for.

The decode is at an eighth, straight out of the DCT, so this costs seconds on a
scan that takes minutes to extract, and the rectangles come back in the working
frame the params file is written in.
"""
import argparse, json, os, sys
import numpy as np
from scipy.ndimage import gaussian_filter, uniform_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import canvas_edge                                          # noqa: E402

STROKE_MM = 5.0        # the scale the band pass is centred on, about a stroke
PREVIEW = 900.0        # px across, for the energy map


def energy(path, cm_w, tile_px, step_px, px_per_cm):
    """Band-pass energy at stroke scale, on a small proxy of the canvas."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    im.draft("RGB", (int(PREVIEW), int(PREVIEW)))
    (cx, cy, cw, ch), (W, H) = canvas_edge.rect(path)
    k = im.size[0] / W
    if (cx, cy, cw, ch) != (0, 0, W, H):
        im = im.crop(tuple(int(round(t * k)) for t in (cx, cy, cx + cw, cy + ch)))
    w = int(PREVIEW)
    h = max(1, int(round(im.size[1] * w / im.size[0])))
    a = np.asarray(im.convert("L").resize((w, h), Image.LANCZOS), np.float32) / 255.0

    # the working frame this canvas will be extracted in
    ww = int(round(cm_w * px_per_cm))
    scale = w / ww                                       # working px -> proxy px
    sigma = STROKE_MM / 10.0 * px_per_cm * scale         # a stroke, in proxy px
    band = gaussian_filter(a, sigma * 0.5) - gaussian_filter(a, sigma * 2.0)
    e = uniform_filter(band * band, int(max(3, round(tile_px * scale))))
    return e, scale, (ww, int(round(h / scale)))


def pick(path, cm_w, tile_px=3072, step_px=512, px_per_cm=120.0):
    e, scale, (ww, wh) = energy(path, cm_w, tile_px, step_px, px_per_cm)
    t = int(round(tile_px * scale))
    if t >= min(e.shape) - 2:                            # a canvas smaller than a tile
        tile_px = int(min(ww, wh) * 0.8) // 64 * 64
        t = int(round(tile_px * scale))
    hi = e.shape[0] - t, e.shape[1] - t
    best, worst = None, None
    for yy in range(0, max(1, hi[0]), max(1, int(step_px * scale))):
        for xx in range(0, max(1, hi[1]), max(1, int(step_px * scale))):
            v = float(e[yy + t // 2, xx + t // 2])
            r = (int(round(xx / scale)), int(round(yy / scale)), tile_px, tile_px)
            if best is None or v > best[0]:
                best = (v, r)
            if worst is None or v < worst[0]:
                worst = (v, r)
    return dict(paint=list(best[1]), thin=list(worst[1])), best[0], worst[0], (ww, wh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scan")
    ap.add_argument("--cm", type=float, required=True, help="canvas width in cm")
    ap.add_argument("--px-per-cm", type=float, default=120.0)
    a = ap.parse_args()
    tiles, hi, lo, (ww, wh) = pick(a.scan, a.cm, px_per_cm=a.px_per_cm)
    print(json.dumps(tiles), f"   working {ww}x{wh}   paint/thin energy {hi/max(lo,1e-12):.1f}x")


if __name__ == "__main__":
    main()
