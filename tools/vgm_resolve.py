#!/usr/bin/env python3
"""Resolve Van Gogh Museum works to their Micrio gigapixel IIIF sources.

Phase 1 of asset harvesting (DESIGN.md §4.1, §8.3). Queries the VGM collection
search, pulls every (title, object number, micrio id) triple out of the embedded
markup, then asks Micrio's info.json for the native pixel dimensions.

Prints a TSV so the candidates can be curated by hand before anything is pulled.
"""
import json, re, sys, time, urllib.request, urllib.parse

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SEARCH = "https://www.vangoghmuseum.nl/en/collection/search?q="
INFO = "https://iiif.micr.io/{}/info.json"

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1:
                return None
            time.sleep(1.5 * (i + 1))
    return None

# One search result block carries the object number in the href and the micrio id
# in the srcset; they appear in that order inside a single <div role="article">.
BLOCK = re.compile(r'aria-label="(?P<label>[^"]*)".*?/en/collection/(?P<obj>[sdbpSDBP][0-9]+[A-Za-z0-9]*).*?iiif\.micr\.io/(?P<mic>[A-Za-z0-9_-]+)/', re.S)

_dims = {}
def dims(mic):
    if mic in _dims:
        return _dims[mic]
    raw = get(INFO.format(mic))
    wh = (0, 0)
    if raw:
        try:
            d = json.loads(raw)
            wh = (int(d.get("width", 0)), int(d.get("height", 0)))
        except Exception:
            pass
    _dims[mic] = wh
    time.sleep(0.2)
    return wh

def resolve(query):
    raw = get(SEARCH + urllib.parse.quote(query))
    if not raw:
        return []
    try:
        html = json.loads(raw).get("resultsHtml", "")
    except Exception:
        html = raw.decode("utf-8", "replace")
    out, seen = [], set()
    for m in BLOCK.finditer(html):
        obj, mic = m.group("obj"), m.group("mic")
        if obj in seen:
            continue
        seen.add(obj)
        w, h = dims(mic)
        out.append((m.group("label").strip(), obj, mic, w, h))
    return out

if __name__ == "__main__":
    queries = [q for q in (l.strip() for l in sys.stdin) if q and not q.startswith("#")]
    print("query\ttitle\tobject\tmicrio\twidth\theight\tmegapixels")
    for q in queries:
        rows = resolve(q)
        if not rows:
            print(f"{q}\t-- NO RESULTS --\t\t\t0\t0\t0")
        for (title, obj, mic, w, h) in rows[:6]:
            print(f"{q}\t{title}\t{obj}\t{mic}\t{w}\t{h}\t{w*h/1e6:.1f}")
        sys.stdout.flush()
        time.sleep(0.4)
