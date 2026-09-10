#!/usr/bin/env python3
"""Per-stroke depth, and how far you can walk before it tears.

DESIGN.md 4.4's *shelled* treatment: each stroke gets a depth, the canvas
becomes a shell with real parallax over a limited range, and the design's own
sentence about it is the thing worth measuring -- *convincing for a few metres
of movement, grotesque beyond that.* How many metres is a few?

**The depth is hand-authored and this file does not pretend otherwise.**
DESIGN 15 is right that monocular depth estimation on a Van Gogh is outside the
training distribution of every model worth using, so the authoring is a handful
of control points in canvas coordinates with a depth in metres each, written in
the station file where a person can read them, and interpolated by inverse
distance. That is invention, it is declared, and the runtime says so in the
caption. What is *not* invented is what follows from it.

**Where a shell tears, in closed form.** Two strokes that are neighbours on the
canvas sit on almost the same ray, so from the painter's position they touch.
Put them at depths d1 and d2 and step the eye sideways by delta, and the angle
between them opens by about

    delta * |1/d1 - 1/d2|

while a stroke of canvas width w still subtends w * hfov / canvas_width. The
paint has torn when the first exceeds the second, so every neighbouring pair
has a **tear distance** and it is one division:

    delta_tear = theta_w / |1/d1 - 1/d2|

No simulation, no sampling, no threshold except the one that says how much
tearing is too much. Pairs at the same depth never tear; pairs straddling a
depth edge tear at once. The distribution over pairs is the whole answer, and
the station's viewing volume is read off it.

**Pre-registered:** the shell's half-width is the displacement at which **5%**
of canvas-adjacent pairs have opened a gap a stroke wide. That number is a
choice; the curve is printed either side of it so the choice can be argued with.

This is the same question M3 asked of the lifted treatment and answered with
paint density -- the Harvest's plain thins to a quarter by 6 m -- so the two
are directly comparable, and comparing them is the point.

    tools/shell.py strokes/s08/olive-canvas.json stations/s08-saint-remy.json
    tools/shell.py strokes/s08/olive-canvas.json stations/s08-saint-remy.json --audit
"""
import argparse, json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EPS = 1e-12
KNN = 5                # canvas neighbours a stroke is tested against
NEAR = 1.5             # ... within this many stroke widths, or they are not adjacent
TEAR_FRAC = 0.05       # pre-registered: 5% of pairs torn is the edge of the volume
CURVE = (0.01, 0.02, 0.05, 0.10, 0.20, 0.40)


def author(doc, spec):
    """Depth per stroke, in metres along its own ray, by inverse distance.

    Canvas coordinates are square -- u times the aspect -- so a control point
    influences a circle on the canvas rather than an ellipse.
    """
    d = spec["depth"]
    pts = np.array([[p[0], p[1]] for p in d["points"]], np.float64)
    val = np.array([p[2] for p in d["points"]], np.float64)
    pw = float(d.get("power", 2.0))
    cw, ch = doc["canvas_px"]
    asp = cw / ch

    P = np.array([r["p"] for r in doc["strokes"]], np.float64)
    mid = 0.25 * P[:, 0] + 0.5 * P[:, 1] + 0.25 * P[:, 2]
    q = mid * np.array([asp, 1.0])
    c = pts * np.array([asp, 1.0])
    dist = np.hypot(q[:, None, 0] - c[None, :, 0], q[:, None, 1] - c[None, :, 1])
    w = 1.0 / np.maximum(dist, 1e-4) ** pw
    dep = (w * val).sum(1) / w.sum(1)
    exact = dist.min(1) < 1e-4
    if exact.any():
        dep[exact] = val[dist[exact].argmin(1)]
    return mid, dep


def tears(doc, spec, mid, dep):
    """The displacement at which each canvas-adjacent pair opens a stroke-wide gap."""
    from scipy.spatial import cKDTree
    cw, ch = doc["canvas_px"]
    asp = cw / ch
    wid = np.array([r["w"] for r in doc["strokes"]], np.float64)      # of the short edge
    hfov = math.radians(float(spec.get("hfov", 50.0)))
    # a stroke's angular width from the painter's position: the canvas is
    # hfov wide and `asp` short-edges across, so this is exact.
    tw = wid * hfov / max(asp, EPS)

    q = mid * np.array([asp, 1.0])
    tree = cKDTree(q)
    k = min(KNN + 1, len(q))
    dd, jj = tree.query(q, k=k)
    i = np.repeat(np.arange(len(q)), k - 1)
    j = jj[:, 1:].ravel()
    sep = dd[:, 1:].ravel()
    near = sep < NEAR * np.maximum(wid[i], wid[j])
    i, j = i[near], j[near]
    if len(i) < 50:
        return None
    inv = np.abs(1.0 / np.maximum(dep[i], EPS) - 1.0 / np.maximum(dep[j], EPS))
    thw = 0.5 * (tw[i] + tw[j])
    with np.errstate(divide="ignore"):
        dt = np.where(inv > EPS, thw / np.maximum(inv, EPS), np.inf)
    return dict(pairs=len(i), tear=dt,
                half=float(np.percentile(dt, TEAR_FRAC * 100)),
                curve=[(f, float(np.percentile(dt, f * 100))) for f in CURVE])


def shell(doc, spec, audit=False, verbose=True):
    mid, dep = author(doc, spec)
    t = tears(doc, spec, mid, dep)
    d = spec["depth"]
    rep = dict(method="hand", points=len(d["points"]), power=float(d.get("power", 2.0)),
               near=float(dep.min()), far=float(dep.max()),
               median=float(np.median(dep)),
               tear_frac=TEAR_FRAC,
               half=float(t["half"]) if t else 0.0,
               pairs=int(t["pairs"]) if t else 0,
               curve=t["curve"] if t else [])
    if verbose:
        print(f"{doc['slug']}/{doc['tile']}: {len(dep)} strokes, "
              f"{len(d['points'])} authored depths, inverse distance power {rep['power']:.0f}")
        print(f"  depth               {dep.min():.1f} m nearest,"
              f" {np.median(dep):.1f} m median, {dep.max():.0f} m furthest"
              f"   ({np.percentile(dep,5):.1f} to {np.percentile(dep,95):.0f} m over the middle 90%)")
        if t:
            print(f"  neighbours          {t['pairs']} canvas-adjacent pairs, "
                  f"within {NEAR} stroke widths of each other")
            print(f"  how far you can go  " + "  ".join(
                f"{f*100:.0f}% torn at {v:.2f} m" for f, v in t["curve"]))
            print(f"  ==> half-width      {t['half']:.2f} m"
                  f"   (pre-registered: {TEAR_FRAC*100:.0f}% of pairs opened a stroke-wide gap)")
    return rep, dep


def find_spec(station, blob):
    for c in station["canvases"]:
        if os.path.basename(c["blob"]) == os.path.basename(blob):
            return c
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("station")
    ap.add_argument("--audit", action="store_true", help="measure, write nothing")
    a = ap.parse_args()
    doc = json.load(open(a.json))
    st = json.load(open(a.station))
    spec = find_spec(st, os.path.splitext(a.json)[0] + ".bin")
    if spec is None or not spec.get("depth"):
        print(f"{os.path.basename(a.json)}: no depth authored in "
              f"{os.path.basename(a.station)}; nothing to do")
        return
    rep, dep = shell(doc, spec, a.audit)
    if a.audit:
        print("  --audit: nothing written")
        return
    doc["shell"] = rep
    for s, v in zip(doc["strokes"], dep):
        s["depth"] = float(v)
    json.dump(doc, open(a.json, "w"))
    print(f"  wrote depth into {os.path.relpath(a.json, ROOT)}")


if __name__ == "__main__":
    main()
