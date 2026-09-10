#!/usr/bin/env python3
"""Recover full native resolution from Micrio, which caps full/max at ~42 MP.

The Van Gogh Museum's IIIF server silently downsamples any single request above
roughly 42 megapixels, so the gigapixel scans arrive at a fraction of their real
size. Region requests are not capped, so we ask for the image in tiles and
reassemble it.

Only run for works whose delivered file sits below the px/cm target: past that
we would be paying for canvas weave (see tools/plan_resolution.py).
"""
import os, sys, time, urllib.request
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
UA = "VanGoghUniverse-research/0.1 (offline art-historical stroke analysis)"
TILE = 4096
DEST = "ref/originals"

def region(mic, x, y, w, h, tries=4):
    url = f"https://iiif.micr.io/{mic}/{x},{y},{w},{h}/max/0/default.jpg"
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            im = Image.open(__import__("io").BytesIO(data)).convert("RGB")
            return np.asarray(im)
        except Exception as e:
            if i == tries - 1:
                print(f"      region {x},{y} failed: {type(e).__name__}: {e}", flush=True)
                return None
            time.sleep(2 * (i + 1))
    return None

def stitch(mic, W, H, out):
    canvas = np.zeros((H, W, 3), dtype=np.uint8)
    nx, ny = (W + TILE - 1) // TILE, (H + TILE - 1) // TILE
    done = 0
    for ty in range(ny):
        for tx in range(nx):
            x, y = tx * TILE, ty * TILE
            w, h = min(TILE, W - x), min(TILE, H - y)
            a = region(mic, x, y, w, h)
            if a is None:
                return False
            canvas[y:y + a.shape[0], x:x + a.shape[1]] = a[:h, :w]
            done += 1
            print(f"      tile {done}/{nx*ny}", end="\r", flush=True)
    print(f"      {nx*ny} tiles assembled            ", flush=True)
    Image.fromarray(canvas).save(out, "JPEG", quality=94, optimize=False, subsampling=0)
    del canvas
    return True

WANT = {
    "sunflowers-vgm",
    "irises-vgm-stilllife", "the-white-orchard", "wheatfield-with-a-reaper",
    "the-harvest", "the-yellow-house", "olive-grove",
}

def main():
    rows = [l.rstrip("\n").split("\t") for l in open("tools/sources.tsv", encoding="utf-8")
            if l.strip() and not l.startswith("#")]
    for station, slug, holder, ident, w, h, url in rows:
        if slug not in WANT or "micr.io" not in url:
            continue
        mic = url.split("micr.io/")[1].split("/")[0]
        W, H = int(w), int(h)
        out = os.path.join(DEST, f"s{int(station):02d}-{slug}_{holder}_{ident}_{W}x{H}.jpg")
        if os.path.exists(out):
            im = Image.open(out)
            if im.size == (W, H):
                print(f"have  {slug} {W}x{H}", flush=True); continue
        print(f"stitch {slug}  {W}x{H} = {W*H/1e6:.0f} MP", flush=True)
        t0 = time.time()
        if stitch(mic, W, H, out):
            print(f"      -> {os.path.getsize(out)/1048576:.1f} MB in {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    main()
