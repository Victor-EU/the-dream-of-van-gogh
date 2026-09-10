#!/usr/bin/env python3
"""Does the flood at station 2 survive a profile audit?

BUILD.md's risk table has carried this row since M0b: *the stations do not sit
on one colour footing -- forty scans, twelve institutions, loose profile
handling -- and the number that says so is whether station 2's flood survives a
profile audit.* It is the effect in the piece most exposed to a decoding
mistake, because it is a Nuenen canvas against Paris canvases and the whole
point of it is that the colour changes. If that change turns out to be a
mismatch between two colour spaces we will have shipped a lie about the most
famous change in his work, and it will look exactly like the truth.

Three parts, and the third is the one that decides.

**What is actually embedded.** `tools/extract.py` records each scan's profile in
its working-image metadata and records the *absence* where there is nothing to
honour, rather than assuming sRGB silently. This reads those back.

**What a wrong assumption could do.** The scans with no profile are decoded as
sRGB because something has to be assumed. The plausible alternatives are not
hypothetical: of the nine files in this set that *do* carry a profile, two are
Adobe RGB (1998) and two are Apple's Generic RGB at gamma 1.8, which is what
`paintings/CREDITS.md` has recorded since M0b. So both are applied here to each
canvas's own paint, in both directions, and the largest movement is the bound --
the most that a profile error could move this canvas's palette.

**What the paint does.** Area-weighted mean lightness and chroma in CIE Lab over
the stroke record itself: the colours the piece actually draws, weighted by how
much canvas each one covers, because a metre of sky is more paint than a
fleck. Then the flood is the distance from station 1's palette to station 2's.

The bound is on the *difference*, which is the part that took a second try. A
profile error applied to every scan alike moves both stations the same way and
mostly cancels out of a difference between them; what would actually forge a
flood is a *mismatch* -- station 1 decoded under one assumption and station 2
under the other. So the bound is adversarial: each station is decoded under
whichever of the two makes the flood as large as possible, and what is left is
how much flood a mismatch could manufacture out of nothing. Bounding the flood
by how far one canvas can move is the same mistake M5 made with the vanishing
point, on a quantity that was not the one in question.

**Pre-registered, and written into this file before station 1's canvas had
finished extracting**: the flood is how far apart the two stations stand in
that plane; it survives if it is at least three times
the adversarial bound; and it must still be at least that with the one canvas
that is not a Van Gogh Museum scan dropped, because the Potato Eaters and four
of the five Paris canvases come off the same museum's rig and a mismatch
between two scans in one campaign is the least likely error of all.

    tools/palette.py                 # the audit, and the verdict
    tools/palette.py --profiles      # what each scan declares
"""
import argparse, glob, json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import extract as E                                          # noqa: E402

FLOOD_MIN = 3.0        # PRE-REGISTERED: flood / profile bound
EPS = 1e-12

# sRGB and Adobe RGB (1998) to XYZ, D65, both from their own specifications.
M_SRGB = np.array([[0.4124564, 0.3575761, 0.1804375],
                   [0.2126729, 0.7151522, 0.0721750],
                   [0.0193339, 0.1191920, 0.9503041]])
M_ADOBE = np.array([[0.5767309, 0.1855540, 0.1881852],
                    [0.2973769, 0.6273491, 0.0752741],
                    [0.0270343, 0.0706872, 0.9911085]])
# and Apple's Generic RGB, gamma 1.8, which is not a hypothetical: both Orsay
# files in this set carry it, and paintings/CREDITS.md has said so since M0b.
M_APPLE = np.array([[0.4497288, 0.3162486, 0.1844926],
                    [0.2446525, 0.6720283, 0.0833192],
                    [0.0251848, 0.1411824, 0.9224628]])


def lab(rgb255):
    """sRGB bytes -> CIE Lab, through the extractor's own decode."""
    lin = E.srgb_to_linear(np.asarray(rgb255, np.float32))
    return E.linear_to_lab(lin)


def linear_to_srgb(lin):
    a = np.clip(lin, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055) * 255.0


def as_if_adobe(rgb255):
    """These bytes were Adobe RGB (1998) and we read them as sRGB. Undo that.

    The bytes are fixed -- they are what is in the file. What changes is which
    space they are numbers in. So decode them with Adobe's transfer and
    primaries, take that through XYZ into linear sRGB, and re-encode: what comes
    out is the sRGB the rest of this pipeline would have been handed if the scan
    had carried the profile it might have had. The re-encode is not optional and
    leaving it out was worth a whole run of nonsense -- every canvas moved by 25
    in a plane where the flood itself is a few, because a linear number was
    being read as a gamma-encoded one.
    """
    a = np.clip(np.asarray(rgb255, np.float32) / 255.0, 0, 1)
    xyz = np.power(a, 563.0 / 256.0) @ M_ADOBE.T                  # Adobe's gamma
    return linear_to_srgb(xyz @ np.linalg.inv(M_SRGB).T)


def as_if_apple(rgb255):
    """These bytes were Apple's Generic RGB -- gamma 1.8 -- and we read them as sRGB."""
    a = np.clip(np.asarray(rgb255, np.float32) / 255.0, 0, 1)
    xyz = np.power(a, 1.8) @ M_APPLE.T
    return linear_to_srgb(xyz @ np.linalg.inv(M_SRGB).T)


def as_if_srgb_read_as_adobe(rgb255):
    """The other direction, which is a mismatch the other way and not an inverse."""
    lin = E.srgb_to_linear(np.asarray(rgb255, np.float32))
    xyz = lin @ M_SRGB.T
    a = np.clip(xyz @ np.linalg.inv(M_ADOBE).T, 0, 1) ** (256.0 / 563.0)
    # and back out of Adobe the way the pipeline reads bytes: as sRGB.
    return a * 255.0


def palette(doc):
    """Area-weighted mean L* and C* over one canvas's strokes.

    Weighted by arc length times width, in canvas pixels, because the question
    is what the paint looks like and not what the average mark looks like.
    """
    st = doc["strokes"]
    if not st:
        return None
    rgb = np.array([s["rgb"] for s in st], np.float32)
    short = min(doc["canvas_px"])
    area = np.array([s["arc"] * s["w"] * short for s in st], np.float32)
    area = np.maximum(area, EPS)
    out = {}
    for name, f in (("as decoded", lambda x: x),
                    ("if Adobe RGB", as_if_adobe),
                    ("if Apple RGB", as_if_apple),
                    ("if read as Adobe", as_if_srgb_read_as_adobe)):
        L, A, B = lab(f(rgb)).T
        # chroma is averaged per stroke and not taken off the mean colour. The
        # Getty irises are blue flowers in green leaves: their mean *colour* is
        # nearly neutral and their mean *chroma* is 27, and it is the second
        # that says what the paint is like. Lightness has no such cancellation,
        # so it is the plain mean. The palette is that pair, and a station's
        # palette is the mean of its canvases'.
        out[name] = (float((L * area).sum() / area.sum()),
                     float((np.hypot(A, B) * area).sum() / area.sum()))
    out["n"] = len(st)
    out["profile"] = doc.get("profile") or ""
    out["flags"] = doc.get("colour_flags", 0)
    return out


def canvases():
    """Every canvas the piece has extracted, with the station it belongs to.

    The station comes off the scan's own filename, which tools/fetch.py wrote
    from tools/sources.tsv's first column, so nothing here is a second list of
    which painting belongs where. A canvas built into more than one milestone's
    directory is taken from the newest, which is the one the piece draws.
    """
    seen = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "strokes", "*", "*-canvas.json"))):
        doc = json.load(open(path))
        slug = doc["slug"]
        if slug in seen and os.path.getmtime(seen[slug][3]) >= os.path.getmtime(path):
            continue
        stem = os.path.basename(E.load_params(slug)["source"])
        station = int(stem[1:3]) if stem[0] == "s" and stem[1:3].isdigit() else 0
        seen[slug] = (station, slug, doc, path)
    return sorted(seen.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profiles", action="store_true",
                    help="what every scan in the piece declares, and nothing else")
    a = ap.parse_args()

    cs = canvases()
    if not cs:
        raise SystemExit("no canvases extracted yet")

    if a.profiles:
        print(f"{'canvas':16s} {'station':>7s}  profile")
        none = 0
        for station, slug, doc, _ in cs:
            pr = doc.get("profile") or ""
            none += not pr
            print(f"{slug:16s} {station:7d}  {pr or 'NONE EMBEDDED, decoded as sRGB'}")
        print(f"\n{none} of {len(cs)} carry no profile at all.")
        return

    rows = []
    for station, slug, doc, _ in cs:
        p = palette(doc)
        if p:
            rows.append((station, slug, p, doc))

    print(f"{'canvas':16s} {'st':>2s} {'strokes':>7s} {'L*':>6s} {'C*':>6s}"
          f" {'a profile moves it':>21s}  profile")
    for station, slug, p, doc in rows:
        L, C = p["as decoded"]
        d = max(float(np.linalg.norm(np.array(p[k]) - np.array(p["as decoded"])))
                for k in ("if Adobe RGB", "if Apple RGB", "if read as Adobe"))
        print(f"{slug:16s} {station:2d} {p['n']:7d} {L:6.1f} {C:6.1f} "
              f"{d:21.2f}  {p['profile'] or 'none'}")

    # and the whole arc, station by station, because the flood is only one step
    # of it and looking at the others is how its shape stops being a surprise.
    print(f"\n{'station':>7s} {'canvases':>8s} {'lightness':>9s} {'chroma':>7s}")
    for st in sorted({r[0] for r in rows}):
        rs = [r for r in rows if r[0] == st]
        L = float(np.mean([r[2]["as decoded"][0] for r in rs]))
        C = float(np.mean([r[2]["as decoded"][1] for r in rs]))
        print(f"{st:7d} {len(rs):8d} {L:9.1f} {C:7.1f}")

    one = [r for r in rows if r[0] == 1]
    two = [r for r in rows if r[0] == 2]
    if not one or not two:
        print("\nstations 1 and 2 are not both extracted yet; no verdict.")
        return

    def mean_lab(rs, key):
        """One station's palette: the mean of its canvases' (lightness, chroma)."""
        return np.array([np.mean([r[2][key][i] for r in rs]) for i in (0, 1)])

    for label, keep in (("all scans", lambda r: True),
                        ("Van Gogh Museum only", lambda r: "VGM" in
                         E.load_params(r[1])["source"])):
        o = [r for r in one if keep(r)]
        t = [r for r in two if keep(r)]
        if not o or not t:
            continue
        a, b = mean_lab(o, "as decoded"), mean_lab(t, "as decoded")
        flood = float(np.linalg.norm(b - a))
        # the adversarial bound: decode each station under whichever assumption
        # pulls the two furthest apart, and subtract the flood that is really
        # there. What is left is flood a mismatch could have forged.
        keys = ("as decoded", "if Adobe RGB", "if Apple RGB", "if read as Adobe")
        forged = 0.0
        for ka in keys:
            for kb in keys:
                if ka == kb:
                    continue
                d = float(np.linalg.norm(mean_lab(t, kb) - mean_lab(o, ka)))
                forged = max(forged, abs(d - flood))
        print(f"\n{label}   ({len(o)} canvas against {len(t)})")
        print(f"  station 1  lightness {a[0]:5.1f}   chroma {a[1]:5.1f}")
        print(f"  station 2  lightness {b[0]:5.1f}   chroma {b[1]:5.1f}")
        print(f"  the flood                                {flood:6.1f}")
        print(f"  the most a profile mismatch could forge  {forged:6.1f}")
        r = flood / max(forged, EPS)
        print(f"  the flood is {r:.1f}x that   "
              f"{'SURVIVES' if r >= FLOOD_MIN else 'DOES NOT SURVIVE'} the "
              f"pre-registered {FLOOD_MIN:.0f}x")


if __name__ == "__main__":
    main()
