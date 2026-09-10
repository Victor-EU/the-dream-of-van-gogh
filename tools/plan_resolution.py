#!/usr/bin/env python3
"""Decide the working resolution for each source scan.

Stroke fitting (DESIGN.md 4.1) wants enough pixels to measure a brushstroke's
width and ridge, and no more: a Van Gogh stroke runs roughly 3-15 mm, so about
120 px/cm (~305 dpi) puts a 4 mm stroke across ~48 px, which is where the
structure tensor scales of step 2 are aimed. Far beyond that the scan is
resolving canvas weave and craquelure, which is noise for stroke fitting and
costs real time and memory.

So: scrape each work's true canvas size, compare against what the server
actually delivered, and flag only the works that fall short of target or that
we are needlessly oversampling.
"""
import os, re, sys, time, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
TARGET = 120.0  # px/cm
DEST = "ref/originals"
DIM = re.compile(r"(?:oil on canvas|oil on paper|oil on cardboard|canvas)[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*cm\s*x\s*([0-9]+(?:\.[0-9]+)?)\s*cm", re.I)

def canvas_cm(objid):
    url = f"https://www.vangoghmuseum.nl/en/collection/{objid}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            html = r.read().decode("utf-8", "replace")
    except Exception:
        return None
    m = DIM.search(re.sub(r"<[^>]*>", " ", html))
    return (float(m.group(1)), float(m.group(2))) if m else None

def jpeg_dims(path):
    import struct
    try:
        d = open(path, "rb").read(256 * 1024)
        i = 2
        while i < len(d) - 9:
            if d[i] != 0xFF: i += 1; continue
            m = d[i+1]
            if m in (0xC0, 0xC1, 0xC2, 0xC3):
                h, w = struct.unpack(">HH", d[i+5:i+9]); return w, h
            if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7: i += 2; continue
            i += 2 + struct.unpack(">H", d[i+2:i+4])[0]
    except Exception: pass
    return 0, 0

rows = [l.rstrip("\n").split("\t") for l in open("tools/sources.tsv", encoding="utf-8")
        if l.strip() and not l.startswith("#")]
print("station\tslug\tcanvas_wxh_cm\tnative_px\thave_px\tnative_pxcm\thave_pxcm\tverdict")
for station, slug, holder, ident, w, h, url in rows:
    name = f"s{int(station):02d}-{slug}_{holder}_{ident}_{w}x{h}.jpg"
    path = os.path.join(DEST, name)
    hw, hh = jpeg_dims(path) if os.path.exists(path) else (0, 0)
    cm = canvas_cm(ident) if holder == "VGM" else None
    time.sleep(0.25)
    if cm:
        # the museum prints height x width, so cm[1] is the width
        npc = int(w) / cm[1]
        hpc = hw / cm[1] if hw else 0
        cms = f"{cm[1]}x{cm[0]}"
    else:
        npc = hpc = 0; cms = "?"
    if not hw:
        verdict = "MISSING"
    elif hpc and hpc < TARGET * 0.8 and npc > hpc * 1.15:
        verdict = f"STITCH -> {npc:.0f}px/cm"
    elif hpc and hpc < TARGET * 0.8:
        verdict = "LOW (best available)"
    elif not cm:
        verdict = "have (non-VGM)"
    else:
        verdict = "ok"
    print(f"{station}\t{slug}\t{cms}\t{w}x{h}\t{hw}x{hh}\t{npc:.0f}\t{hpc:.0f}\t{verdict}")
    sys.stdout.flush()
