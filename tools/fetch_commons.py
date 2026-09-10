#!/usr/bin/env python3
"""Re-fetch the Wikimedia-hosted scans that hit HTTP 429, politely.

Wikimedia rate-limits bulk originals hard. One file at a time, a long pause
between them, exponential backoff on 429, and a contactable User-Agent as their
policy asks.
"""
import os, sys, time, urllib.error, urllib.request

UA = "VanGoghUniverse-research/0.1 (offline art-historical stroke analysis; contact: victor.zhang.eu@gmail.com)"
DEST = "ref/originals"
GAP = 25

def fetch(url, path):
    delay = 20
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as fh:
                got = 0
                while True:
                    chunk = r.read(4 << 20)
                    if not chunk: break
                    fh.write(chunk); got += len(chunk)
            os.rename(path + ".part", path)
            return got
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"    429, sleeping {delay}s (attempt {attempt+1})", flush=True)
                time.sleep(delay); delay = min(delay * 2, 300); continue
            print(f"    HTTP {e.code}", flush=True); return 0
        except Exception as e:
            print(f"    {type(e).__name__}: {e}", flush=True)
            time.sleep(delay); delay = min(delay * 2, 300)
    return 0

def main():
    rows = []
    for line in open("tools/sources.tsv", encoding="utf-8"):
        if line.startswith("#") or not line.strip(): continue
        f = line.rstrip("\n").split("\t")
        if "wikimedia.org" in f[6] or "wikipedia" in f[6]:
            rows.append(f)
    for i, (station, slug, holder, ident, w, h, url) in enumerate(rows, 1):
        name = f"s{int(station):02d}-{slug}_{holder}_{ident}_{w}x{h}.jpg"
        path = os.path.join(DEST, name)
        if os.path.exists(path) and os.path.getsize(path) > 100_000:
            print(f"[{i}/{len(rows)}] have  {name}", flush=True); continue
        print(f"[{i}/{len(rows)}] get   {name}", flush=True)
        t0 = time.time()
        got = fetch(url, path)
        if got:
            print(f"    -> {got/1048576:.1f} MB in {time.time()-t0:.0f}s", flush=True)
        if i < len(rows):
            time.sleep(GAP)

if __name__ == "__main__":
    main()
