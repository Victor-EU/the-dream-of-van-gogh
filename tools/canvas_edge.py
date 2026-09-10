#!/usr/bin/env python3
"""Find the painted rectangle inside a scan, and audit the whole set for margin.

Whole-canvas coordinates are only meaningful if 0 and 1 are the edges of the
*painting*. A scan that carries a strip of backdrop, a stretcher bar or the
photographer's table puts every stroke at the wrong fraction of the canvas, and
because the error is a translation plus a scale it is invisible in any single
tile -- it shows up when two canvases are hung beside each other and one of them
is a percent bigger than it should be.

A margin has almost no local variance, because it is not paint. So: walk in
from each edge while the row's mean gradient magnitude stays far below the
interior's. But quiet alone is not enough -- a dark sky is quiet too, and the
first draft of this cropped 503 px off the top of the church at Auvers, which
is 11% of that painting and all of it sky. The difference is that **a margin
ends and a sky continues**: at a real boundary the activity steps, and across a
dark passage it ramps. So a candidate is only accepted if the paint just inside
it is markedly busier than the strip just outside. That one test is what
separates the three scans below that do carry a margin from the one that only
looks like it does. It runs on a JPEG's DCT-scaled thumbnail, so auditing forty
scans costs seconds.

    tools/canvas_edge.py ref/originals/xyz.jpg      # one file, verbose
    tools/canvas_edge.py --audit                    # every scan in ref/originals
"""
import argparse, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Image.MAX_IMAGE_PIXELS = None

THUMB = 1400          # px on the long edge for the detector
FRAC = 0.45           # a row below this fraction of the interior is not paint
RUN = 3               # consecutive paint-like rows needed to stop the walk
STEP = 1.6            # paint just inside a real edge is at least this much busier


def thumb(path, long_edge=THUMB):
    """DCT-scaled decode: a 127 MP JPEG becomes a thumbnail without decoding."""
    im = Image.open(path)
    im.draft("RGB", (long_edge, long_edge))
    im = im.convert("RGB")
    if max(im.size) > long_edge:
        im.thumbnail((long_edge, long_edge), Image.LANCZOS)
    return im


def activity(a):
    """Mean gradient magnitude per row and per column. Paint is busy."""
    g = a.astype(np.float32).mean(-1)
    gy, gx = np.gradient(g)
    d = np.hypot(gx, gy)
    return d.mean(1), d.mean(0)


def _step_ok(prof, cut, inward):
    """Is `cut` a boundary, or just a quiet passage of the painting?

    Compare the strip immediately outside the cut with the paint immediately
    inside it. A backdrop meeting a canvas edge steps; a sky getting darker
    toward the top of the picture does not.
    """
    n = len(prof)
    if cut == (0 if inward else n):
        return True
    w = 4 * RUN
    if inward:
        out, ins = prof[max(0, cut - w):cut], prof[cut + 1:cut + 1 + w]
    else:
        out, ins = prof[cut:min(n, cut + w)], prof[max(0, cut - 1 - w):cut - 1]
    if not len(out) or not len(ins):
        return True
    return float(np.median(ins)) >= STEP * max(float(np.median(out)), 1e-3)


def _walk(prof, ref):
    """First and last index that look like paint, from each end."""
    n = len(prof)
    lo = 0
    while lo < n - RUN and (prof[lo:lo + RUN] < FRAC * ref).all():
        lo += 1
    hi = n
    while hi > lo + RUN and (prof[hi - RUN:hi] < FRAC * ref).all():
        hi -= 1
    if not _step_ok(prof, lo, True):
        lo = 0
    if not _step_ok(prof, hi, False):
        hi = n
    return lo, hi


def rect(path):
    """(x, y, w, h) of the painting inside the scan, in full-resolution px."""
    im = Image.open(path)
    W, H = im.size
    t = np.asarray(thumb(path))
    th, tw = t.shape[:2]
    rows, cols = activity(t)
    # the interior half is the reference: it is paint by construction
    ref_r = float(np.median(rows[th // 4:th - th // 4]))
    ref_c = float(np.median(cols[tw // 4:tw - tw // 4]))
    y0, y1 = _walk(rows, ref_r)
    x0, x1 = _walk(cols, ref_c)
    sx, sy = W / tw, H / th
    # round outward: never crop paint on the strength of a thumbnail
    X0, Y0 = int(np.floor(x0 * sx)), int(np.floor(y0 * sy))
    X1, Y1 = int(np.ceil(x1 * sx)), int(np.ceil(y1 * sy))
    return (X0, Y0, X1 - X0, Y1 - Y0), (W, H)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?")
    ap.add_argument("--audit", action="store_true")
    a = ap.parse_args()

    if a.audit:
        d = os.path.join(ROOT, "ref", "originals")
        files = sorted(f for f in os.listdir(d) if f.lower().endswith((".jpg", ".png", ".tif")))
        n_margin = 0
        for f in files:
            (x, y, w, h), (W, H) = rect(os.path.join(d, f))
            m = max(x, y, W - x - w, H - y - h)
            tag = f"  margin {m} px  ({x},{y},{w},{h})" if m else ""
            if m:
                n_margin += 1
            print(f"{'MARGIN' if m else '  ok  '}  {W}x{H}  {f}{tag}")
        print(f"\n{n_margin} of {len(files)} scans carry a margin.")
        return

    (x, y, w, h), (W, H) = rect(a.path)
    print(f"scan {W}x{H}   painting {w}x{h} at ({x},{y})")
    print(f"margin  left {x}  top {y}  right {W-x-w}  bottom {H-y-h}")


if __name__ == "__main__":
    main()
