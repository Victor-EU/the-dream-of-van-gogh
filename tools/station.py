#!/usr/bin/env python3
"""Do the station files hold together, and does the piece's time make sense?

M6 turns tau into a chronology across all ten stations, and the moment it did,
four canvases turned out to be standing in stations their own museums date them
outside of. Two of those were known and written down -- the Reaper at station 4,
and the Almond Blossom overhead at station 3, which DESIGN 7 put there on
purpose. Two were not: the Van Gogh Museum dates its Sunflowers January 1889,
five months after the station it stands in, and its Orchard in Blossom April
1889, a year after the spring that station is about.

So the rule this tool enforces is not that a canvas must be in its own year. It
is that **a canvas may be out of place, and only knowingly and in writing**: a
`when` outside its station's `span` is fine and is reported, and a `when`
outside its station's span with no `note` beside it is an error. The piece is
allowed to put a canvas where the argument wants it. It is not allowed to do so
quietly, and it is not allowed to move the date to make the file tidy.

It also checks the arithmetic the runtime depends on before anything loads: the
stroke counts in the station files are what fix every canvas's share of tau, and
they are read from the file rather than from the blob so that the timing does
not shift under the viewer as blobs land. A count that has drifted from its blob
is a station whose pacing is wrong from the first frame.

    tools/station.py             # audit every station
    tools/station.py --sync      # take the counts from the blobs and write them
"""
import argparse, datetime, glob, json, os, re, struct, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def blob_count(path):
    """The stroke count out of a packed blob's header, at byte 12."""
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return None
    with open(full, "rb") as f:
        head = f.read(16)
    if len(head) < 16 or head[:4] != b"VGST":
        return None
    return struct.unpack_from("<I", head, 12)[0]


def iso(s):
    return datetime.date.fromisoformat(s) if s else None


def months(a, b):
    return (b.year - a.year) * 12 + (b.month - a.month) + (b.day - a.day) / 30.44


def stations():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "stations", "*.json"))):
        out.append((path, json.load(open(path))))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sync", action="store_true",
                    help="write each canvas's stroke count from its blob")
    a = ap.parse_args()

    bad, notes, moved = 0, 0, 0
    prev = prevhi = None
    for path, sn in stations():
        rel = os.path.relpath(path, ROOT)
        lo, hi = (iso(sn["span"][0]), iso(sn["span"][1])) if sn.get("span") else (None, None)
        print(f"\n{rel}   station {sn['id']}  {sn['title']}"
              f"   {sn['span'][0]} to {sn['span'][1]}")
        # The arc must not go backwards, and *starts* are what say so. Two
        # stations may overlap and two do: he was painting the Yellow House and
        # the night of Arles in the same three weeks of September 1888, and the
        # last fortnight at Auvers is both station 9 and station 10. An overlap
        # is a fact about the life; a start earlier than the station before it
        # is the map ceasing to be the chronology.
        if prev and lo and prev > lo:
            print(f"  the arc goes backwards: this starts before the one before it ({prev})")
            bad += 1
        if prevhi and lo and prevhi > lo:
            print(f"  overlaps the station before it by {months(lo, prevhi) * 30.44:.0f} days"
                  f" -- the date on the band steps back here")
        prev, prevhi = lo, hi
        if not sn["canvases"]:
            beat = sn.get("pacing", {}).get("beat")
            print(f"  no canvases, and a beat of {beat} s"
                  if beat else "  no canvases and no beat: this station has no length")
            bad += beat is None
            continue
        for c in sn["canvases"]:
            n = blob_count(c["blob"])
            w = iso(c.get("when"))
            tag = ""
            if n is None:
                tag = "   NO BLOB"
                bad += 1
            elif n != c.get("strokes"):
                tag = f"   count {c.get('strokes')} -> {n}"
                if a.sync:
                    c["strokes"] = n
                    moved += 1
                else:
                    bad += 1
            out = ""
            if w and lo and hi and not (lo <= w <= hi):
                d = months(hi, w) if w > hi else months(w, lo)
                out = f"   OUT OF SPAN by {abs(d):.0f} months"
                notes += 1
                if not c.get("note"):
                    out += "  AND NOT WRITTEN DOWN"
                    bad += 1
            elif not w:
                out = "   no date"
                bad += 1
            print(f"  {c['title'][:38]:38s} {c.get('when', '--'):11s}"
                  f" {(n if n is not None else 0):6d}{tag}{out}")
        if a.sync:
            json.dump(sn, open(path, "w"), indent=1, ensure_ascii=False)
            open(path, "a").write("\n")

    # M6's third exit criterion, as a number: no station is longer than its
    # material justifies. A station's length in tau is its own strokes over its
    # own burst rate -- how long the making takes at M2's measured 4,000x -- or,
    # with no strokes, the beat it declares. Nothing here says what the right
    # length is; it says what each one is, next to how much paint is in it, so
    # that a station that is long because it has a lot of canvas in it can be
    # told from one that is long because its burst rate is slow.
    print("\n\nhow long each station is, and what pays for it\n")
    print(f"  {'station':28s} {'strokes':>8s} {'burst':>6s} {'seconds':>8s}  share")
    secs, tot, sns = [], 0, [sn for _, sn in stations()]
    for sn in sns:
        n = sum(c.get("strokes", 0) for c in sn["canvases"])
        burst = sn.get("pacing", {}).get("burst", 2000)
        t = n / burst if n else sn.get("pacing", {}).get("beat", 0)
        secs.append((sn["id"], sn["title"], n, burst, t))
        tot += t
    # the same rule index.html uses: a road is as long as the months it crosses,
    # four seconds at least and twenty-four at most.
    roads = [min(24.0, 4.0 + max(0.0, months(iso(a["span"][1]), iso(b["span"][0]))) * 2.0)
             for a, b in zip(sns, sns[1:])]
    road = sum(roads)
    for sid, title, n, burst, t in secs:
        print(f"  {str(sid) + ' ' + title:28s} {n:8d} {burst:6d} {t:8.1f}  "
              f"{t / max(tot + road, 1e-9) * 100:4.1f}%")
    print(f"  {'the roads between them':28s} {'':8s} {'':6s} {road:8.1f}  "
          f"{road / max(tot + road, 1e-9) * 100:4.1f}%")
    print("  " + "  ".join(f"{a['id']}->{b['id']} {r:.0f}s"
                           for (a, b), r in zip(zip(sns, sns[1:]), roads)))
    print(f"  {'the whole arc':28s} {sum(r[2] for r in secs):8d} {'':6s} "
          f"{tot + road:8.1f}")

    print(f"\n{notes} canvas(es) stand outside their station's span, "
          f"which is allowed and is written down." if notes else "")
    if a.sync:
        print(f"synced {moved} stroke count(s)")
    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
