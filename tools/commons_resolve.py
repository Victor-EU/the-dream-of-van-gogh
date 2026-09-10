#!/usr/bin/env python3
"""Find the largest Wikimedia Commons reproduction of a painting.

Covers the holders that publish no usable open-access API of their own
(MoMA, Musee d'Orsay, Kroller-Muller) and the ones whose endpoints sit behind
a bot wall (Art Institute of Chicago). Reports dimensions so a candidate can be
judged against DESIGN.md 4.1's 6000px floor before it is pulled.
"""
import json, sys, time, urllib.request, urllib.parse

API = "https://commons.wikimedia.org/w/api.php"
UA = "VanGoghUniverse-research/0.1 (stroke-extraction source gathering)"

def api(params):
    params = dict(params, format="json")
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read())
        except Exception:
            if i == 2:
                return {}
            time.sleep(1.5 * (i + 1))
    return {}

def largest(query, limit=30):
    d = api({
        "action": "query", "generator": "search",
        "gsrsearch": f"{query} van Gogh", "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|size|mime",
    })
    rows = []
    for p in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/tiff"):
            continue
        w, h = ii.get("width", 0), ii.get("height", 0)
        if w * h < 4e6:
            continue
        rows.append((w * h, w, h, p.get("title", "").replace("File:", ""), ii.get("url", "")))
    rows.sort(reverse=True)
    return rows

if __name__ == "__main__":
    queries = [q for q in (l.strip() for l in sys.stdin) if q and not q.startswith("#")]
    print("query\ttitle\twidth\theight\tmegapixels\turl")
    for q in queries:
        rows = largest(q)
        if not rows:
            print(f"{q}\t-- NONE >4MP --\t0\t0\t0\t")
        for (_, w, h, title, url) in rows[:4]:
            print(f"{q}\t{title}\t{w}\t{h}\t{w*h/1e6:.1f}\t{url}")
        sys.stdout.flush()
        time.sleep(0.3)
