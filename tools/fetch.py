#!/usr/bin/env python3
"""Download the curated source scans listed in tools/sources.tsv into ref/originals/.

Skips anything already present, verifies the delivered JPEG's real dimensions
against the manifest, and writes a log. ref/ is deliberately outside the
repository (DESIGN.md 13).
"""
import os, struct, sys, time, urllib.request

UA = "VanGoghUniverse-research/0.1 (stroke-extraction source gathering)"
DEST = "ref/originals"

def jpeg_dims(path):
    try:
        with open(path, "rb") as fh:
            d = fh.read(256 * 1024)
        i = 2
        while i < len(d) - 9:
            if d[i] != 0xFF:
                i += 1; continue
            m = d[i + 1]
            if m in (0xC0, 0xC1, 0xC2, 0xC3):
                h, w = struct.unpack(">HH", d[i + 5:i + 9]); return w, h
            if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
                i += 2; continue
            i += 2 + struct.unpack(">H", d[i + 2:i + 4])[0]
    except Exception:
        pass
    return 0, 0

def main():
    os.makedirs(DEST, exist_ok=True)
    rows = []
    for line in open("tools/sources.tsv", encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        rows.append(line.rstrip("\n").split("\t"))
    for n, (station, slug, holder, ident, w, h, url) in enumerate(rows, 1):
        name = f"s{int(station):02d}-{slug}_{holder}_{ident}_{w}x{h}.jpg"
        path = os.path.join(DEST, name)
        if os.path.exists(path) and os.path.getsize(path) > 100_000:
            print(f"[{n}/{len(rows)}] skip  {name}", flush=True); continue
        t0 = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r, open(path + ".part", "wb") as fh:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk: break
                    fh.write(chunk)
            os.rename(path + ".part", path)
        except Exception as e:
            print(f"[{n}/{len(rows)}] FAIL  {name}  {type(e).__name__}: {e}", flush=True)
            if os.path.exists(path + ".part"): os.remove(path + ".part")
            continue
        mb = os.path.getsize(path) / 1048576
        gw, gh = jpeg_dims(path)
        ok = "OK " if (gw, gh) == (int(w), int(h)) else f"DIMS {gw}x{gh}!"
        print(f"[{n}/{len(rows)}] {ok} {name}  {mb:.1f}MB  {time.time()-t0:.0f}s", flush=True)
        time.sleep(0.3)

if __name__ == "__main__":
    main()
