#!/usr/bin/env python3
"""Does the light agree across one museum's scans?

BUILD.md's risk table: *"Impasto is measuring colour, not relief — flat-field
museum photography has erased the signal — the number that says so is that l
scatters across the VGM scans."* This is that number.

Twenty-four of the forty scans are Van Gogh Museum files, shot on one rig. The
antisymmetric cue of `tools/relief.py` recovers a net light direction per
canvas. If the rig has any imbalance at all, every canvas off it must report the
*same* direction, because the direction is a fact about the room and not about
the painting. If the directions scatter, either the rig is symmetric enough to
have cancelled the cue -- which is what museum flat-field lighting is for -- or
we are measuring the composition, and either way the antisymmetric half of M1's
height estimate is worthless and the fallback is what ships.

The test needs no extraction. It reads ridge points straight out of the
structure tensor on a handful of crops per canvas, which is seconds rather than
the five and a half minutes a full canvas costs.

The estimator is checked before it is believed. `--synthetic` builds canvases of
ridges of known height under a light of known direction, with the albedo spread
tuned so the synthetic's own flank statistics match the Reaper's, and sweeps the
light from a single lamp at 45 degrees down to nothing. It answers two questions
a bare R cannot: what the method reports when there is definitely no light, and
how strong a light has to be before it reports it.

    tools/light_audit.py                 # every VGM scan
    tools/light_audit.py --all           # every scan, grouped by collection
    tools/light_audit.py --synthetic     # the control: does the method work?
"""
import argparse, json, os, re, sys, time
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import extract as E
import relief as R
from scipy.ndimage import gaussian_filter

TARGET = 120.0              # px/cm, the working resolution of the whole build
CROP = 1536
RUN = 9                     # stations along each ridge point
RUN_STEP = 8.0              # px between them
SIGMA = 4.0                 # the profile's own smoothing: above the 9 px weave
                            # and the 6 px brush striation, well below a flank


def credits_table():
    """slug-ish key -> (collection, px_per_cm), from paintings/CREDITS.md.

    The scans themselves carry no scale, so the source of truth is the file that
    records where each one came from and how big the canvas is. Rows whose
    dimensions CREDITS marks unverified are skipped rather than guessed at.
    """
    rows = {}
    txt = open(os.path.join(ROOT, "paintings", "CREDITS.md")).read()
    for line in txt.splitlines():
        if not line.startswith("|"):
            continue
        c = [x.strip() for x in line.strip("|").split("|")]
        if len(c) < 9 or not re.fullmatch(r"\d+", c[0]):
            continue
        acc = c[3].strip("`")
        m = re.search(r"\*\*(\d+)\*\*", c[8])
        if not m:
            continue                                     # canvas size unverified
        rows[acc] = (c[2], float(m.group(1)))
    return rows


def scans(want_all=False):
    tab = credits_table()
    out = []
    d = os.path.join(ROOT, "ref", "originals")
    for f in sorted(os.listdir(d)):
        m = re.match(r"(.+?)_([A-Z-]+)_(.+?)_(\d+)x(\d+)\.jpg$", f)
        if not m:
            continue
        name, coll, acc = m.group(1), m.group(2), m.group(3)
        if acc not in tab:
            continue
        if not want_all and coll != "VGM":
            continue
        out.append(dict(name=name, coll=coll, acc=acc, path=os.path.join(d, f),
                        ppcm=tab[acc][1]))
    return out


def working(path, ppcm, verbose=False):
    """Decode to the build's working resolution. DCT-scaled, so a 714 MP file
    never exists at 714 MP."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    W, H = im.size
    s = min(1.0, TARGET / ppcm)
    tw, th = max(1, int(round(W * s))), max(1, int(round(H * s)))
    im.draft("RGB", (tw, th))
    if im.mode != "RGB":
        im = im.convert("RGB")
    if im.size != (tw, th):
        im = im.resize((tw, th), Image.LANCZOS)
    return np.asarray(im, np.uint8)


def tiles(H, W, n, rng):
    """Crop origins that do not overlap.

    Drawing them at random looked harmless and was not: a canvas photographed at
    376 px/cm comes down to 1693 x 2300 at the working resolution, so eight
    random 1536 px crops are eight views of nearly the same paint. The votes are
    then correlated and the resultant sits well above its nominal chance level
    for no reason but the sampling -- which is how a null result puts on a
    finding's clothes.
    """
    ox = list(range(0, max(1, W - CROP + 1), CROP))
    oy = list(range(0, max(1, H - CROP + 1), CROP))
    g = [(x, y) for y in oy for x in ox]
    rng.shuffle(g)
    return g[:n]


def probe(img, p, half_w, crops=6, seed=18531890, per_crop=4000):
    """Antisymmetric amplitudes and normals from ridge points across the image."""
    rng = np.random.default_rng(seed)
    H, W = img.shape[:2]
    A, N, HV, ST = [], [], [], []
    for x, y in tiles(H, W, crops, rng):
        rgb = np.ascontiguousarray(img[y:y + CROP, x:x + CROP])
        if min(rgb.shape[:2]) < CROP // 2:
            continue
        chans, _ = E.channels(rgb, p)
        L = chans[0]
        if float(L.std()) < 0.01:
            continue                                    # blank backdrop, not paint
        nx, ny, coh, en = E.structure_tensor(
            chans, dict(p, tensor_energy_frac=0.0), 1.0)
        m = min(rgb.shape[:2]) // 8
        coh[en < float(np.median(en[m:-m, m:-m])) * p["tensor_energy_frac"]] = 0.0
        Fs, lnn = E.ridge_field(L, p["sigma_ridge"], nx, ny)
        surf = gaussian_filter(L, SIGMA)
        thr = float(np.percentile(np.abs(lnn), p["seed_strength_pct"]))
        h, w = L.shape
        sx, sy, pol, st = E.find_seeds(Fs, lnn, coh, nx, ny, p, thr,
                                       (0, 0, w, h))
        if len(sx) > per_crop:
            k = np.argsort(-st)[:per_crop]
            sx, sy, pol, st = sx[k], sy[k], pol[k], st[k]
        if not len(sx):
            continue
        n = np.stack([E.samp(nx, sx, sy), E.samp(ny, sx, sy)], 1)
        n /= np.maximum(np.hypot(n[:, 0], n[:, 1]), 1e-9)[:, None]
        t = np.stack([-n[:, 1], n[:, 0]], 1)
        off = (np.arange(RUN, dtype=np.float32) - (RUN - 1) / 2) * RUN_STEP
        P = (np.stack([sx, sy], 1)[:, None, :] + t[:, None, :] * off[None, :, None]
             ).reshape(-1, 2)
        NN = np.repeat(n, RUN, axis=0)
        pp = np.repeat(pol, RUN)
        hw = np.full(len(P), half_w, np.float32)
        anti, sym, hv, live = R.cues(surf, P, NN, hw, pp)
        # one vote per ridge point, not per station: the stations of a run are
        # 64 px of the same stroke and are not independent
        a = np.where(live, anti, np.nan).reshape(-1, RUN)
        with np.errstate(invalid="ignore"):
            A.append(np.nan_to_num(np.nanmedian(a, axis=1)))
        N.append(n)
        HV.append(np.median(hv.reshape(-1, RUN), axis=1))
        ST.append(st)
    if not A:
        z = np.zeros(0, np.float32)
        return z, np.zeros((0, 2), np.float32), z, z
    return (np.concatenate(A), np.concatenate(N), np.concatenate(HV),
            np.concatenate(ST))


SPREAD = 0.25               # albedo spread that reproduces the Reaper's |anti|


def synthetic(deg, gain, spread=SPREAD, seed=3, N=2600, S=3072, hw=30.0, rel=0.12):
    """Ridges `rel` as tall as they are wide, each its own loaded colour, lit by
    one lamp. `gain` is tan(incidence): 1.0 is a single lamp at 45 degrees and
    is the most a museum rig can plausibly impose; a balanced pair is 0."""
    rng = np.random.default_rng(seed)
    Z = np.zeros((S, S), np.float32)
    A = np.full((S, S), 0.45, np.float32)
    for _ in range(N):
        cx, cy = rng.uniform(0, S, 2)
        th, L = rng.uniform(0, np.pi), rng.uniform(120, 320)
        w = hw * rng.uniform(0.6, 1.6)
        r = int(L / 2 + w) + 3
        x0, x1 = max(0, int(cx) - r), min(S, int(cx) + r)
        y0, y1 = max(0, int(cy) - r), min(S, int(cy) + r)
        if x1 <= x0 or y1 <= y0:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        tx, ty = np.cos(th), np.sin(th)
        u = (xx - cx) * -ty + (yy - cy) * tx
        v = (xx - cx) * tx + (yy - cy) * ty
        m = (np.abs(u) < w) & (np.abs(v) < L / 2)
        z = (2 * w * rel) * np.cos(np.pi * u / (2 * w)) ** 2
        sub = Z[y0:y1, x0:x1]
        hit = m & (z > sub)
        sub[hit] = z[hit]
        A[y0:y1, x0:x1][m] = 0.45 * (1.0 + spread * rng.uniform(-1, 1))
    Z = gaussian_filter(Z, 3.0)
    A = gaussian_filter(A, 2.0)
    gy, gx = np.gradient(Z)
    lx, ly = np.cos(np.radians(deg)), -np.sin(np.radians(deg))     # +y is down
    # the normal of a height field is (-dZ/dx, -dZ/dy, 1): a flank tilting
    # towards the lamp brightens, which is the minus sign
    I = A * (1.0 - gain * (gx * lx + gy * ly))
    return np.repeat((np.clip(I, 0, 1) ** (1 / 2.4) * 255)
                     .astype(np.uint8)[..., None], 3, -1)


def control(p, half_w, want=-101.0):
    def run(gain, seed=3):
        a, N, hv, st = probe(synthetic(want, gain, seed=seed), p, half_w,
                             crops=4, per_crop=20000)
        l, Rv, n = R.solve_light(a, N)
        return (float(np.degrees(np.arctan2(-l[1], l[0]))), Rv, n,
                float(np.mean(np.abs(a))) if len(a) else float("nan"))

    print("no light at all, five canvases, contrast matched to the Reaper:")
    ds = []
    for seed in (3, 11, 29, 47, 83):
        d, Rv, n, ma = run(0.0, seed)
        ds.append(d)
        print(f"  seed {seed:3d}   |anti| {ma*100:5.2f}%   R {Rv:.4f} vs "
              f"{R.chance_R(n):.4f} chance   {d:+7.1f} deg   ({n} points)")
    th = np.radians(ds)
    v = np.array([np.cos(th).sum(), np.sin(th).sum()]) / len(ds)
    print(f"  -> unlit canvases agree to {np.hypot(*v):.3f}, "
          f"and this is the distribution any real R has to beat\n")
    print(f"the same canvas under a real light at {want:+.0f} deg:")
    print(f"{'tan(incidence)':>15} {'flank asym':>11} {'recovered':>10} {'err':>7} "
          f"{'R':>8} {'chance':>8}")
    for gain in (1.0, 0.3, 0.1, 0.03, 0.01):
        d, Rv, n, ma = run(gain)
        print(f"{gain:15.2f} {ma*100:10.2f}% {d:+10.1f} "
              f"{((d - want + 180) % 360) - 180:+7.1f} {Rv:8.4f} "
              f"{R.chance_R(n):8.4f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--crops", type=int, default=6)
    ap.add_argument("--out", default="ref/work/light_audit.json")
    a = ap.parse_args()
    p = json.load(open(os.path.join(ROOT, "params", "reaper.json")))
    half_w = 34.0                       # the Reaper's median stroke, halved
    if a.synthetic:
        return control(p, half_w)

    rows = []
    for s in scans(a.all):
        t = time.time()
        img = working(s["path"], s["ppcm"])
        anti, N, hv, st = probe(img, p, half_w, a.crops)
        del img
        light, Rv, n = R.solve_light(anti, N)
        deg = float(np.degrees(np.arctan2(-light[1], light[0])))   # +y is down
        top = st >= np.percentile(st, 75) if len(st) else np.zeros(0, bool)
        l4, R4, n4 = R.solve_light(anti[top], N[top])
        deg4 = float(np.degrees(np.arctan2(-l4[1], l4[0])))
        rows.append(dict(name=s["name"], coll=s["coll"], acc=s["acc"],
                         ppcm=s["ppcm"], deg=deg, R=Rv, n=n,
                         chance=R.chance_R(n), deg_top=deg4, R_top=R4, n_top=n4,
                         chance_top=R.chance_R(n4),
                         half_w=float(half_w * np.median(hv)) if len(hv) else 0.0))
        print(f"  {s['coll']:14s} {s['name'][:44]:44s} "
              f"{deg:+7.1f} deg   R {Rv:.4f} vs {R.chance_R(n):.4f} chance"
              f"   n {n:6d}   half-w {half_w*np.median(hv) if len(hv) else 0:.0f} px"
              f"   | top quarter {deg4:+7.1f} R {R4:.4f} vs {R.chance_R(n4):.4f}"
              f"   {time.time()-t:.0f}s", flush=True)

    print()
    for coll in sorted({r["coll"] for r in rows}):
        g = [r for r in rows if r["coll"] == coll]
        if len(g) < 2:
            continue
        th = np.radians([r["deg"] for r in g])
        w = np.array([r["R"] for r in g])
        v = np.array([(w * np.cos(th)).sum(), (w * np.sin(th)).sum()])
        agree = float(np.hypot(*v) / max(w.sum(), 1e-9))
        mean = float(np.degrees(np.arctan2(v[1], v[0])))
        sd = float(np.degrees(np.sqrt(max(-2 * np.log(max(agree, 1e-9)), 0.0))))
        z = len(g) * agree ** 2                       # Rayleigh, on the canvases
        print(f"{coll}: {len(g)} scans   mean {mean:+.1f} deg   "
              f"agreement {agree:.3f} (chance {np.sqrt(np.pi)/(2*np.sqrt(len(g))):.3f}"
              f", Rayleigh p {np.exp(-z):.1e})   circular sd {sd:.1f} deg   "
              f"median R {np.median([r['R'] for r in g]):.4f}")

    dest = os.path.join(ROOT, a.out)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    json.dump(rows, open(dest, "w"), indent=1)
    print(f"-> {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    main()
