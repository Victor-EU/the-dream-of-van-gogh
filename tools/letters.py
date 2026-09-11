#!/usr/bin/env python3
"""His words, checked against the edition before they ship.

DESIGN 9 asks for one line per station from his own letters, and for every
quotation to be verified against the Van Gogh Museum and Huygens ING edition
before it ships: he is among the most misquoted people in art, and no line goes
in from memory, the famous ones least of all.

M3 put a `letter` in every station file as a citation with no text, so that
nothing would be typed from memory before M7 could check it. The citations were
typed from memory. Checked against the edition before a word of text went in,
seven of the nine were wrong -- 569 is to Horace Mann Livens and not to Wil, 590
and 678 are to Wil and not to Theo, 628 is to Bernard, and 782, 898 and 902 are
each dated differently from the day the file gave. So this is the only way a
line gets into a station, and the check it runs is one a stranger can run:

  - the letter exists, and the recipient, place and date in the station file are
    the edition's own words, written in by this tool and never typed;
  - every fragment of the line, split at the ellipsis, is in the named paragraph
    of the edition's English translation, verbatim and in order -- or, for the
    letters he wrote in English, in his original -- and a line that starts or
    stops inside a sentence says so with an ellipsis;
  - the canvas the line appears at is one the edition's own note says the
    passage is about, matched on the holder's name and the size in centimetres.
    Where the passage names no canvas the piece has, the station file says why
    the line stands where it does, and this checks that the notes around it
    really do name none;
  - the letter was written inside the station's span, a fortnight either side.

It writes letters/letters.json, which is what a stranger checks: the line, the
paragraph, the original paragraph it renders in the language he wrote it, the
work the edition identifies, and the links.

The translations are the edition's -- Leo Jansen, Hans Luijten and Nienke
Bakker (eds.), Vincent van Gogh - The Letters, Van Gogh Museum & Huygens ING,
2009 -- which releases its source files under CC BY-NC-SA 4.0. The record
carries the citation the edition asks for and that licence.

    tools/letters.py              # check every station's line, write the record
    tools/letters.py --check      # check only, and that the record is current
    tools/letters.py --refresh    # ask the edition again rather than the cache
"""
import argparse, datetime, glob, html, json, os, re, time, unicodedata, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "letters", ".cache")
RECORD = os.path.join(ROOT, "letters", "letters.json")
SITE = "https://vangoghletters.org"
PAGE = SITE + "/vg/letters/let{n}/{kind}.html"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
CITE = ("Leo Jansen, Hans Luijten, Nienke Bakker (eds.) (2009), Vincent van Gogh - The Letters. "
        "Version: {}. Amsterdam & The Hague: Van Gogh Museum & Huygens ING. https://vangoghletters.org")
LICENCE = ("CC BY-NC-SA 4.0 -- the licence the edition gives its own source files "
           "(https://vangoghletters.org/vg/about_6.html, section 6.4)")
SLACK = datetime.timedelta(days=14)  # a letter a fortnight either side of a station is still its letter
NEAR = 2                             # paragraphs either side a note may sit and still be about the line
CM = 2.0                             # the edition gives sizes to the centimetre and the holders do not
LONG = 20                            # DESIGN 9: a line, read in the seconds before it fades
WEEKDAY = re.compile(r"\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*")
MONTHS = {m: i + 1 for i, m in enumerate(
    "January February March April May June July August September October November December".split())}
_last = [0.0]


def get(url, refresh=False):
    """A page of the edition, from the cache if it has been read before."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, re.sub(r"[^\w.-]+", "_", url.split("://", 1)[1]))
    if os.path.exists(path) and not refresh:
        return open(path, encoding="utf-8").read()
    err = None
    for i in range(3):
        wait = 0.5 - (time.time() - _last[0])      # one request at a time, and not fast
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                body = r.read().decode("utf-8", "replace")
            _last[0] = time.time()
            open(path, "w", encoding="utf-8").write(body)
            return body
        except Exception as e:
            err, _last[0] = e, time.time()
            time.sleep(1.5 * (i + 1))
    raise SystemExit(f"could not reach the edition: {url}\n  {err}")


def clean(s):
    s = re.sub(r'(?s)<span class="anchor">.*?</a></span>', "", s)
    s = re.sub(r'(?s)<span class="(?:fac-icon|pagebreak)">.*?</span>', "", s)
    s = html.unescape(re.sub(r"<[^>]+>", "", s)).replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def paragraphs(page):
    """Every paragraph of one of the edition's texts, in its order and counting the
    empty ones, with the notes each cites. The translation and the original agree on
    the count almost everywhere; where the two paragraphs cite different notes the
    record says so rather than trusting the number."""
    return [(clean(p), list(dict.fromkeys(re.findall(r"noteref-(n-\d+)", p))))
            for p in re.findall(r'(?s)<div class="p[^"]*">(.*?)</div>', page)]


def metadata(n, refresh):
    page = get(PAGE.format(n=n, kind="letter"), refresh)
    m = re.search(r'(?s)id="metadata-panel"(.*?)more\.\.\.', page)
    if not m:
        raise SystemExit(f"letter {n}: no metadata on the edition's page; has the page changed shape?")
    t = clean(m.group(1))
    pick = lambda pat: (re.search(pat, t) or [None, None])[1]
    place, _, date = (pick(r"Date: (.*)$") or "").partition(", ")
    return {"to": pick(r"To: (.*?) Date:"), "place": place.strip(),
            "date": WEEKDAY.sub("", date).strip().rstrip("."),
            "Br. 1990": pick(r"Br\. 1990: (\S+)"), "CL": pick(r"CL: (\S+)")}


def days(date):
    """The first and the last day a date in the edition's words can mean."""
    full = [datetime.date(int(y), MONTHS[m], int(d))
            for d, m, y in re.findall(r"(\d{1,2}) ([A-Z][a-z]+) (\d{4})", date) if m in MONTHS]
    if full:
        # 'Sunday, 9 and about Friday, 14 September': a bare day shares the month after it
        full += [full[0].replace(day=int(d)) for d in re.findall(r"\b(\d{1,2}) (?:and|or)\b", date)]
        return min(full), max(full)
    ms = [MONTHS[w] for w in re.findall(r"[A-Z][a-z]+", date) if w in MONTHS]
    ys = [int(y) for y in re.findall(r"\d{4}", date)]
    if not ms or not ys:
        return None, None
    y, m = ys[-1], ms[-1]
    return (datetime.date(ys[0], ms[0], 1),
            datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1))


def notes(page):
    """The edition's notes, and the works of his each one identifies."""
    out = {}
    for nid, body in re.findall(r'(?s)<div class="notediv" id="(n-\d+)">(.*?)'
                                r'(?=<div class="notediv"|<a name="top"|\Z)', page):
        works = []
        for maker, title, credit in re.findall(
                r"imagePanel\.show\(\d+,\d+,'((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'", body):
            if html.unescape(maker) != "Vincent van Gogh":
                continue
            title, credit = (html.unescape(x).replace("\\'", "'").replace("\u00a0", " ")
                             for x in (title, credit))
            f = re.search(r"\(F ([^/()]*?) ?/ ?JH ([^)]*?)\)", title)
            cm = re.search(r"([\d.]+)\s*x\s*([\d.]+)\s*cm", title)
            w = {"title": title.split(" (F ")[0], "F": f.group(1).strip() if f else None,
                 "JH": f.group(2).strip() if f else None,
                 "cm": [float(cm.group(1)), float(cm.group(2))] if cm else None, "credit": credit}
            if w not in works:
                works.append(w)
        out[nid] = {"text": clean(body), "works": works}
    return out


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


STOP = {"the", "a", "an", "at", "with", "of", "in", "on", "and", "de", "la", "le", "les", "version",
        "second", "third", "first"}


def words_of(title):
    return {w[:-1] if w.endswith("s") and len(w) > 3 else w for w in norm(title).split()} - STOP


def same(work, cv):
    """One object, not two alike. The holder's name has to be inside the edition's
    credit line, the edition's title has to be the canvas's title, and the size has
    to agree -- all three, because each alone names a crowd. The Van Gogh Museum
    alone holds five canvases in this piece that are within two centimetres of
    73 x 92, which is a size-30 canvas off the shelf; and the sizes themselves are
    two authorities' measurements of one object, the edition's to the centimetre
    and the holder's to the millimetre or from inches, so they are allowed a
    twentieth apart and the record says so wherever they are more than 2 cm."""
    holder = norm((cv.get("collection") or "").split(",")[0])
    if not holder or holder not in norm(work["credit"]):
        return False
    a, b = words_of(work["title"]), words_of(cv.get("title") or "")
    if not a or not (a <= b or b <= a):
        return False
    if not (work["cm"] and cv.get("cm")):
        return False
    x, y = sorted(work["cm"]), sorted(cv["cm"])
    return all(abs(p - q) <= max(CM, 0.05 * q) for p, q in zip(x, y))


def canvases(sn):
    out = {}
    for c in sn.get("canvases", []):
        stem = os.path.basename(c["blob"]).split("-canvas")[0]
        p = os.path.join(ROOT, "params", stem + ".json")
        out[stem] = dict(c, stem=stem, cm=json.load(open(p)).get("canvas_cm") if os.path.exists(p) else None)
    return out


def find(text, para):
    """Where each fragment of the line sits in the paragraph, in order, or the first
    one that is not there."""
    at, spans = 0, []
    for f in (x.strip() for x in text.split("…")):
        if not f:
            continue
        k = para.find(f, at)
        if k < 0:
            return None, f
        spans.append((k, k + len(f)))
        at = k + len(f)
    return spans, None


def check(sn, refresh):
    """One station's line against the edition. Returns the record, what is wrong, what
    is worth saying, and the edition's own recipient, place and date."""
    L = sn["letter"]
    n = str(L["n"])
    bad, say = [], []
    meta = metadata(n, refresh)
    tr = paragraphs(get(PAGE.format(n=n, kind="translation"), refresh))
    og = paragraphs(get(PAGE.format(n=n, kind="original_text"), refresh))
    nt = notes(get(PAGE.format(n=n, kind="notes"), refresh))
    cvs = canvases(sn)
    k, text, english = L.get("para"), L.get("text") or "", L.get("lang") == "en"
    src = og if english else tr
    where = "his original" if english else "the translation"

    # the words
    if not isinstance(k, int) or not 0 <= k < len(src):
        bad.append(f"paragraph {k} is not in {where} of letter {n}, which has {len(src)}")
        para = ""
    else:
        para = src[k][0]
        spans, missing = find(text, para)
        if missing is not None:
            bad.append(f"not in paragraph {k} of {where}: '{missing}'")
        elif spans:
            before, after = para[:spans[0][0]].rstrip(), para[spans[-1][1]:].lstrip()
            if not text.lstrip().startswith("…") and before and before[-1] not in ".!?’”:;":
                bad.append("starts inside a sentence without an ellipsis to say so")
            if not text.rstrip().endswith("…") and after and text.rstrip()[-1] not in ".!?’”":
                bad.append("stops inside a sentence without an ellipsis to say so")
    words = len(re.findall(r"[\w’'-]+", text))
    if words > LONG:
        say.append(f"{words} words: more than a line, and DESIGN 9 fades it after seconds")

    # the canvas
    cv = cvs.get(L.get("canvas"))
    if not cv:
        bad.append(f"canvas '{L.get('canvas')}' is not in this station: {', '.join(cvs)}")
    ident = None
    near = range(max(0, (k or 0) - NEAR), min(len(tr), (k or 0) + NEAR + 1))
    cited = {nid: i for i in near for nid in tr[i][1]} if isinstance(k, int) else {}
    if L.get("note"):
        note = nt.get(L["note"])
        hit = [w for w in (note or {}).get("works", []) if cv and same(w, cv)]
        if not note:
            bad.append(f"letter {n} has no note {L['note']}")
        elif L["note"] not in cited:
            bad.append(f"note {L['note']} is not cited within {NEAR} paragraphs of the line")
        elif not hit:
            bad.append(f"note {L['note']} identifies " +
                       ("; ".join(f"{w['title']} (F {w['F']}), {w['credit']}" for w in note["works"])
                        or "no work of his") + f" -- not {cv['title'] if cv else 'this canvas'}")
        else:
            w = hit[0]
            x, y = sorted(w["cm"]), sorted(cv["cm"])
            if any(abs(p - q) > CM for p, q in zip(x, y)):
                say.append(f"the edition gives {w['cm'][0]:g} x {w['cm'][1]:g} cm and the holder "
                           f"{cv['cm'][0]:g} x {cv['cm'][1]:g} cm: one object, two measurements")
            ident = dict(note=L["note"], paragraph=cited[L["note"]], work=w["title"], F=w["F"], JH=w["JH"],
                         cm=w["cm"], credit=w["credit"],
                         also=[f"{x['title']} (F {x['F']})" for x in note["works"] if x is not w])
    else:
        # A line that stands at a canvas without the edition's say-so has to say why, and
        # the why has to be true: nothing cited around it may name a canvas this station has.
        if not L.get("why"):
            bad.append("no note identifies the canvas and there is no `why`")
        for nid in cited:
            for w in nt.get(nid, {}).get("works", []):
                for c in cvs.values():
                    if same(w, c):
                        bad.append(f"the edition's note {nid} says this passage is about {c['title']}: "
                                   f"name it rather than explaining it away")

    # the original, in the language he wrote it
    orig = og[k][0] if isinstance(k, int) and 0 <= k < len(og) else None
    if orig is not None and not english and tr[k][1] and og[k][1] and tr[k][1] != og[k][1]:
        say.append(f"the original's paragraph {k} cites other notes than the translation's: "
                   f"the original recorded may be a neighbour of the right one")

    # the date
    lo, hi = days(meta["date"])
    a, b = (datetime.date.fromisoformat(x) for x in sn["span"])
    if lo is None:
        bad.append(f"cannot read the edition's date '{meta['date']}'")
    elif hi < a - SLACK or lo > b + SLACK:
        (say if L.get("why") else bad).append(
            f"written {meta['date']}, outside the station's {sn['span'][0]} to {sn['span'][1]}")

    rec = {"station": sn["id"], "title": sn["title"], "letter": int(n), "to": meta["to"],
           "place": meta["place"], "date": meta["date"],
           "concordance": {"Br. 1990": meta["Br. 1990"], "CL": meta["CL"]},
           "paragraph": k, "from": "the original, which he wrote in English" if english else "the translation",
           "text": text, "words": words, "original": orig,
           "canvas": {"blob": cv["blob"], "title": cv["title"]} if cv else None,
           "identified": ident, "why": L.get("why"),
           "links": {"translation": f"{SITE}/en/let{n}", "original": f"{SITE}/orig/let{n}"}}
    return rec, bad, say, meta


def main():
    ap = argparse.ArgumentParser(description="Check each station's line against vangoghletters.org.")
    ap.add_argument("--check", action="store_true",
                    help="write nothing; exit 1 if anything is wrong or letters/letters.json is stale")
    ap.add_argument("--refresh", action="store_true", help="ask the edition again rather than the cache")
    a = ap.parse_args()

    home = get(SITE + "/vg/", a.refresh)
    version = (re.search(r"Version:\s*([A-Z][a-z]+ \d{4})", clean(home)) or [None, "unknown"])[1]
    lines, nbad, tied = [], 0, 0
    for path in sorted(glob.glob(os.path.join(ROOT, "stations", "*.json"))):
        sn = json.load(open(path))
        L = sn.get("letter") or {}
        print(f"\nstation {sn['id']}  {sn['title']}")
        if not L.get("n"):
            if L.get("text"):
                print("  a line with no letter number is a line from nowhere")
                nbad += 1
            else:
                print(f"  no line{': ' + sn['_letter'] if sn.get('_letter') else ''}")
            continue
        rec, bad, say, meta = check(sn, a.refresh)
        cite = f"{meta['to']}, {meta['place']}, {meta['date']}"
        print(f"  letter {rec['letter']} to {cite}   (Br. 1990 {meta['Br. 1990']}, CL {meta['CL']})")
        print(f"  paragraph {rec['paragraph']} of {rec['from']}, {rec['words']} words")
        if rec["identified"]:
            i = rec["identified"]
            tied += 1
            print(f"  at {rec['canvas']['title']}: the edition's note {i['note'][2:]}, in paragraph "
                  f"{i['paragraph']}, is {i['work']} (F {i['F']} / JH {i['JH']}), "
                  f"{i['cm'][0]:g} x {i['cm'][1]:g} cm, {i['credit']}")
        elif rec["canvas"]:
            print(f"  at {rec['canvas']['title']}, which the edition does not name here: {rec['why']}")
        # the facts about the letter are the edition's, never the file's
        for key in ("to", "place", "date"):
            if L.get(key) != meta[key]:
                if a.check:
                    bad.append(f"{key} is '{L.get(key)}' and the edition says '{meta[key]}'")
                else:
                    print(f"  {key}: the file said {L.get(key)!r}, the edition says {meta[key]!r}")
                    L[key] = meta[key]
        for s in say:
            print(f"  note: {s}")
        for b in bad:
            print(f"  WRONG: {b}")
        nbad += len(bad)
        lines.append(rec)
        if not a.check:
            order = ["n", "to", "place", "date", "para", "lang", "text", "canvas", "note", "why"]
            sn["letter"] = {key: L[key] for key in order if key in L} | \
                           {key: v for key, v in L.items() if key not in order}
            json.dump(sn, open(path, "w"), indent=1, ensure_ascii=False)
            open(path, "a").write("\n")

    record = {
        "_about": "Every line of his letters the piece shows, and what a stranger needs to check each one "
                  "against the edition: the letter, the paragraph, the words, the paragraph he wrote in the "
                  "language he wrote it, and the canvas the edition's own note says the passage is about. "
                  "Written by tools/letters.py, which reads the edition's public pages; a person chooses a "
                  "line, and nothing else in this file is typed.",
        "edition": {"cite": CITE.format(version), "version": version, "licence": LICENCE},
        "checked": datetime.date.today().isoformat(),
        "lines": lines,
    }
    if a.check:
        old = json.load(open(RECORD)) if os.path.exists(RECORD) else None
        if not old or old.get("lines") != lines or old.get("edition") != record["edition"]:
            print("\nWRONG: letters/letters.json is not what the station files and the edition say now;"
                  " run tools/letters.py")
            nbad += 1
    else:
        os.makedirs(os.path.dirname(RECORD), exist_ok=True)
        json.dump(record, open(RECORD, "w"), indent=1, ensure_ascii=False)
        open(RECORD, "a").write("\n")
    print(f"\n{len(lines)} lines, {tied} at the canvas the edition's own note names, "
          f"{len(lines) - tied} standing where their station file says why.   edition version {version}")
    print(f"{nbad} wrong." if nbad else "Nothing wrong.")
    raise SystemExit(1 if nbad else 0)


if __name__ == "__main__":
    main()
