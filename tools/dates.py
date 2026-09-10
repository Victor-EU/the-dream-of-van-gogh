#!/usr/bin/env python3
"""When each canvas was painted, from the holder's own record.

The piece's primary control is a chronology, so a date is not decoration here:
it is the axis. `paintings/CREDITS.md` already refuses to enter a canvas's
dimensions unless the institution that owns it says so, and a date deserves the
same rule for the same reason -- a plausible date from a third party is exactly
the kind of thing that ends up quoted back as fact.

This asks the Van Gogh Museum's own object pages, which is where 24 of the 40
scans come from and where the rule is cheapest to keep. What it cannot reach it
says it cannot reach, and those go in by hand with their source named.
"""
import json, re, sys, time, urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
OBJ = "https://www.vangoghmuseum.nl/en/collection/{}"


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            if i == tries - 1:
                return ""
            time.sleep(1.5 * (i + 1))
    return ""


# The museum prints the maker, the place and the date as one line under the
# title, and the medium and the size as the line after it. Both are its own
# words about its own object, which is the rule paintings/CREDITS.md already
# keeps for dimensions.
TITLE = re.compile(r'<meta property="og:image:alt" content="([^"]*)"')
CREATOR = re.compile(r'class="art-object-page-content-creator-info"[^>]*>(.*?)</p>', re.S)
DETAIL = re.compile(r'class="art-object-page-content-detail[^"]*"[^>]*>(.*?)</p>', re.S)


def text(m):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else ""


def date_of(obj):
    html = get(OBJ.format(obj))
    if not html:
        return None, None, "no page"
    line = text(CREATOR.search(html))
    if not line:
        return None, None, "not in the page"
    # "Vincent van Gogh (1853 - 1890), Nuenen, April-May 1885"
    after = line.split("),", 1)[-1].strip() if ")," in line else line
    t = TITLE.search(html)
    title = t.group(1) if t else ""
    return after, (title + "  |  " + text(DETAIL.search(html))).strip(), "the object page"


def main():
    objs = sys.argv[1:]
    if not objs:
        seen, out = set(), []
        for line in open("tools/sources.tsv"):
            if line.startswith("#"):
                continue
            f = line.rstrip("\n").split("\t")
            if f[2].startswith("VGM") and f[3] not in seen:
                seen.add(f[3])
                out.append((f[1], f[3]))
        objs = out
    else:
        objs = [(o, o) for o in objs]
    for slug, obj in objs:
        d, detail, how = date_of(obj)
        print(f"{slug:34s} {obj:14s} {d or '--':34s} {how}")
        if detail:
            print(f"{'':34s} {'':14s} {detail}")


if __name__ == "__main__":
    main()
