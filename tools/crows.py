#!/usr/bin/env python3
"""The crows, out of the one canvas that has them.

DESIGN 7 asks for crows at station 10 -- the only living creatures in the
universe -- and for them to have been in the corner of the eye since Arles, and
rule 2 says what they have to be made of: not a modelled bird but his marks.
*Wheatfield with Crows* has about forty of them, and every one is two or three
strokes of black laid over the sky or the far field. So this finds those strokes
in the canvas's own stroke record, groups them into birds, and writes the birds
out where the runtime can reach them long before the canvas itself has streamed
in -- the crows are needed from station 3 and the canvas is the last in the piece.

The rule is three tests, and every number in them is written down here:

  black      under 0.20 in every channel and within 0.08 of grey, and neither of
             the two darks this canvas is otherwise full of: the sky's blue-black,
             where green and blue both stand above red, and the field's
             green-brown, where blue falls below green. Both within 0.05.
  standing   at least 4x darker than the median of the paint within 1.5 cm that
             is not itself black. A crow is a black mark *on* something; the top
             of this sky is black on black, and there it measures 0.7 to 2.
  in the air above 0.6 of the canvas's height, because the shadowed edge of the
             near field in the bottom left corner passes both tests above, at 4.2
             to 6.2. This one was chosen after looking at them, and says so.

A bird is the black strokes whose curves come within half a centimetre of each
other, and a bird wider than 7 cm is not one.

It is a filter for the crows of one painting, not a detector of crows, and the
picture it writes is how to argue with it: strokes/s10/crows-birds.png, every
bird it kept drawn over the scan in its own colour.

    tools/crows.py            # find them; write stations/crows.json and the picture
"""
import hashlib, json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "strokes", "s10", "crows-canvas.json")
OUT = os.path.join(ROOT, "stations", "crows.json")
PIC = os.path.join(ROOT, "strokes", "s10", "crows-birds.png")

BLACK_MAX, BLACK_GREY, BLACK_TILT = 0.20, 0.08, 0.05
STAND_CM, STAND_K = 1.5, 4.0
AIR = 0.60
GAP_CM, BIRD_MAX_CM = 0.5, 7.0


def curve(p, W, H, n=9):
    """A stroke's quadratic Bezier, sampled, in canvas pixels."""
    p = np.asarray(p, float) * [W, H]
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p[0] + 2 * (1 - t) * t * p[1] + t * t * p[2]


def main():
    from scipy.spatial import cKDTree
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    doc = json.load(open(SRC))
    W, H = doc["canvas_px"]
    pxcm = doc["px_per_cm"]
    short_cm = min(doc["canvas_cm"])
    S = doc["strokes"]
    rgb = np.array([s["rgb"] for s in S], float) / 255
    L = (rgb ** 2.2) @ np.array([0.2126, 0.7152, 0.0722])
    hi, lo = rgb.max(1), rgb.min(1)
    g_r, b_g = rgb[:, 1] - rgb[:, 0], rgb[:, 2] - rgb[:, 1]
    black = ((hi < BLACK_MAX) & (hi - lo < BLACK_GREY)
             & (np.abs(g_r) <= BLACK_TILT) & (np.abs(b_g) <= BLACK_TILT))
    mid = np.array([s["p"][1] for s in S]) * [W, H]
    tree = cKDTree(mid)
    ratio = np.zeros(len(S))
    for i in np.where(black)[0]:
        nb = [j for j in tree.query_ball_point(mid[i], STAND_CM * pxcm) if not black[j]]
        ratio[i] = np.median(L[nb]) / max(L[i], 1e-4) if nb else 0.0
    standing = black & (ratio >= STAND_K)
    air = standing & (mid[:, 1] / H < AIR)
    keep = np.where(air)[0]
    C = [curve(S[i]["p"], W, H) for i in keep]
    rows, cols = [], []
    for a in range(len(keep)):
        for b in range(a + 1, len(keep)):
            if np.min(np.linalg.norm(C[a][:, None] - C[b][None], axis=2)) < GAP_CM * pxcm:
                rows.append(a); cols.append(b)
    n, lab = connected_components(coo_matrix((np.ones(len(rows)), (rows, cols)),
                                             shape=(len(keep),) * 2), directed=False)
    birds, dropped = [], 0
    for k in range(n):
        mine = [a for a in range(len(keep)) if lab[a] == k]
        q = np.vstack([C[a] for a in mine])
        span = (q.max(0) - q.min(0)) / pxcm
        if span.max() > BIRD_MAX_CM:
            dropped += 1
            continue
        c = (q.max(0) + q.min(0)) / 2
        strokes = []
        for a in mine:
            s = S[keep[a]]
            # centimetres about the bird's own centre, y up, so a bird can be
            # stood anywhere without knowing which canvas it came off
            pts = [[round((x * W - c[0]) / pxcm, 3), round(-(y * H - c[1]) / pxcm, 3)]
                   for x, y in s["p"]]
            strokes.append({"p": pts, "rgb": s["rgb"],
                            "w": round(s["w"] * short_cm, 3), "h": round(s["h"], 3)})
        birds.append({"at": [round(c[0] / W, 4), round(c[1] / H, 4)],
                      "cm": [round(float(span[0]), 2), round(float(span[1]), 2)],
                      "strokes": strokes})
    birds.sort(key=lambda b: (b["at"][0], b["at"][1]))
    sha = hashlib.sha256(open(SRC, "rb").read()).hexdigest()
    out = {
        "_about": "The crows of Wheatfield with Crows, as his own strokes: written by tools/crows.py from the "
                  "canvas's stroke record, and read by the runtime from station 3 on, long before the canvas "
                  "itself arrives. Each bird is in centimetres about its own centre, y up. The rule that "
                  "picked them is below with its numbers; strokes/s10/crows-birds.png is the picture to argue "
                  "with it by.",
        "canvas": "strokes/s10/crows-canvas.bin",
        "record_sha256": sha,
        "rule": {"black": {"max": BLACK_MAX, "grey": BLACK_GREY, "tilt": BLACK_TILT},
                 "standing": {"within_cm": STAND_CM, "darker_by": STAND_K},
                 "air_above": AIR, "bird_gap_cm": GAP_CM, "bird_max_cm": BIRD_MAX_CM},
        "found": {"strokes": len(S), "black": int(black.sum()), "standing": int(standing.sum()),
                  "in_the_air": int(air.sum()), "birds": len(birds),
                  "strokes_in_birds": sum(len(b["strokes"]) for b in birds),
                  "too_wide_to_be_one": dropped},
        "birds": birds,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(f"{len(S)} strokes: {black.sum()} black, {standing.sum()} standing out from what is "
          f"around them, {air.sum()} in the air")
    print(f"{len(birds)} birds of {sum(len(b['strokes']) for b in birds)} strokes "
          f"({dropped} groups too wide to be one); widest {max(b['cm'][0] for b in birds):.1f} cm")
    print(f"-> {os.path.relpath(OUT, ROOT)}")
    try:
        from PIL import Image, ImageDraw
        src = Image.open(os.path.join(ROOT, doc["source"])).convert("RGB")
        k = 2000 / src.size[0]
        im = src.resize((2000, int(src.size[1] * k)))
        dr = ImageDraw.Draw(im)
        pal = [(255, 40, 40), (255, 230, 0), (0, 230, 255), (255, 0, 255), (60, 255, 60)]
        sx, sy = im.size[0] / W, im.size[1] / H
        for j, b in enumerate(birds):
            cx, cy = b["at"][0] * W, b["at"][1] * H
            for s in b["strokes"]:
                p = [[cx + x * pxcm, cy - y * pxcm] for x, y in s["p"]]
                pts = curve(np.array(p) / [W, H], W, H)
                dr.line([(x * sx, y * sy) for x, y in pts], fill=pal[j % 5], width=3)
        im.save(PIC)
        print(f"-> {os.path.relpath(PIC, ROOT)}")
    except Exception as e:
        print(f"no picture: {e}")


if __name__ == "__main__":
    sys.exit(main())
