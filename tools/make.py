#!/usr/bin/env python3
"""Build a canvas, and say whether anything moved that should not have.

Three jobs, and the third is the one that pays.

**The params discipline.** Every number lives in params/<slug>.json and nothing
is tuned by editing Python. That only holds if the file and the extractor agree
about which numbers exist, so this checks both directions. A key the extractor
wants and the file lacks is a crash later; a key the file has and the extractor
never reads is worse, because it looks exactly like tuning and does nothing.

**The build.** extract -> order -> pack -> flat, skipped when the blob's header
already records this source file and these parameters. The order stage is
separate from extraction because it is the one that has to be argued with: it
reads the strokes back out of the JSON, so it can be re-run and re-measured in
fifteen seconds instead of six minutes, and `--no-order` builds the same canvas
with M1's heuristic sequence for comparison. The header carries both hashes,
so staleness is a fact about the artifact rather than a timestamp.

**The regression.** Two golden images at 1200 px, both committed: the flat
reconstruction and the false-coloured relief field. Every build reports the RMS
difference against each. A change that moves either without meaning to is caught
in seconds instead of in a milestone -- which matters most for the changes that
are supposed to move nothing at all: a refactor, a memory fix, a faster merge.

The relief golden is there because the flat one cannot see relief at all. M1
replaced the height field entirely and the flat golden came back identical to
five decimal places, which is correct and is also exactly the blind spot: with
one image the harness watches the geometry and the colour and nothing watches
the paint standing off the cloth.

    tools/make.py reaper              # build if stale, then check the golden
    tools/make.py reaper --force      # build regardless
    tools/make.py reaper --golden     # accept the current output as golden
    tools/make.py --check             # params discipline over every canvas
"""
import argparse, hashlib, json, os, struct, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import extract as E                                       # noqa: E402

GOLD = os.path.join(ROOT, "strokes", "golden")
PY = sys.executable


def run(*args):
    r = subprocess.run([PY] + [str(a) for a in args], cwd=ROOT)
    if r.returncode:
        raise SystemExit(f"failed: {' '.join(str(a) for a in args)}")


def blob_hashes(path):
    """(source sha, params sha) recorded in a blob's header, or None."""
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        head = f.read(192)
    if head[:4] != b"VGST":
        return None
    hexa = lambda o: head[o:o + 32].hex()
    return hexa(72), hexa(104)


def check_all():
    d = os.path.join(ROOT, "params")
    bad = 0
    for f in sorted(os.listdir(d)):
        if not f.endswith(".json"):
            continue
        try:
            E.check_params(json.load(open(os.path.join(d, f))))
            print(f"  ok      {f}")
        except SystemExit as e:
            print(f"  BROKEN  {f}: {e}")
            bad += 1
    return bad


def rms(a, b):
    a = np.asarray(a, np.float32) / 255.0
    b = np.asarray(b, np.float32) / 255.0
    if a.shape != b.shape:
        return None
    return float(np.sqrt(((a - b) ** 2).mean()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--tile", default=None)
    ap.add_argument("--out", default="strokes/m2")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--golden", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--no-order", action="store_true",
                    help="leave M1's heuristic sequence in place")
    a = ap.parse_args()

    if a.check or not a.slug:
        print("params discipline:")
        raise SystemExit(1 if check_all() else 0)

    from PIL import Image
    p = json.load(open(os.path.join(ROOT, "params", a.slug + ".json")))
    E.check_params(p)
    src = os.path.join(ROOT, p["source"])
    name = a.tile or "canvas"
    stem = os.path.join(ROOT, a.out, f"{a.slug}-{name}")

    want = (E.file_sha256(src), E.params_hash(p))
    have = blob_hashes(stem + ".bin")
    if a.force or have != want:
        why = "forced" if a.force else ("no blob yet" if have is None else
                                        "source" if have[0] != want[0] else "params")
        print(f"building {a.slug}/{name}  ({why} changed)")
        args = ["tools/extract.py", a.slug, "--out", a.out]
        if a.tile:
            args += ["--tile", a.tile]
        run(*args)
        if not a.no_order:
            run("tools/order.py", stem + ".json")
        run("tools/pack.py", stem + ".json")
    else:
        print(f"{a.slug}/{name} is up to date with its source and params")

    os.makedirs(GOLD, exist_ok=True)
    run("tools/flat.py", stem + ".bin", "--px", 1200)
    run("tools/flat.py", stem + ".bin", "--px", 1200, "--heights")
    bad = False
    for tag, what in (("flat", "colour"), ("heights", "relief")):
        shot = Image.open(f"{stem}-{tag}.png").convert("RGB")
        gold_path = os.path.join(GOLD, f"{a.slug}-{name}-{tag}-1200.png")
        if a.golden:
            shot.save(gold_path)
            print(f"golden {what} accepted -> {os.path.relpath(gold_path, ROOT)}")
            continue
        if not os.path.exists(gold_path):
            shot.save(gold_path)
            print(f"golden {what} created -> {os.path.relpath(gold_path, ROOT)}"
                  f"  (nothing to compare against yet; the next build has a baseline)")
            continue
        d = rms(shot, Image.open(gold_path).convert("RGB"))
        if d is None:
            print(f"golden {what} differs in size: the canvas or its crop changed. "
                  "Re-accept it with --golden if that was intended.")
            raise SystemExit(1)
        verdict = ("identical" if d == 0 else
                   "unchanged to the eye" if d < 0.002 else
                   "MOVED" if d > 0.01 else "moved slightly")
        print(f"golden {what:7s} RMS {d:.5f}   {verdict}")
        bad = bad or d > 0.01
    if bad:
        print("  If that was the point, accept it with --golden. If it was not, "
              "this is the regression the golden exists to catch.")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
