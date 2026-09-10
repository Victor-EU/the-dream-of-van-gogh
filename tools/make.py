#!/usr/bin/env python3
"""Build a canvas, and say whether anything moved that should not have.

Three jobs, and the third is the one that pays.

**The params discipline.** Every number lives in params/ -- <slug>.json merged
over _base.json -- and nothing is tuned by editing Python. That only holds if the file and the extractor agree
about which numbers exist, so this checks both directions. A key the extractor
wants and the file lacks is a crash later; a key the file has and the extractor
never reads is worse, because it looks exactly like tuning and does nothing.

**The build.** extract -> order -> place -> curl -> shell -> room -> pack -> flat,
skipped when the blob's header
already records this source file and these parameters. The order stage is
separate from extraction because it is the one that has to be argued with: it
reads the strokes back out of the JSON, so it can be re-run and re-measured in
fifteen seconds instead of six minutes, and `--no-order` builds the same canvas
with M1's heuristic sequence for comparison. `place` is separate for the same
reason and it is cheaper still: two seconds to ask a canvas where its horizon
is and whether it is a place at all, which is a question worth being able to
re-ask. `curl` and `shell` are separate for the third time for the same reason,
and `shell` is separate for a fourth: its input is a station file rather than a
params file, because a hand-authored depth is a decision about a station and
not a fact about a canvas. `room` reads a station for the same reason and adds
one of its own: a built room is six numbers a person typed, and the tool's whole
job there is to report how far its own answer is from them. The header carries
both hashes,
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
    tools/make.py bedroom1 --room stations/s05-yellow-house.json
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
    """Every canvas file, merged over the base, against the extractor's key list.

    The merge is what gets checked because the merge is what runs. A canvas file
    that overrides a base number is fine and shows up as an override; a canvas
    file that invents a key is the expensive failure this exists to catch, and
    the base cannot hide it.
    """
    d = os.path.join(ROOT, "params")
    bad = 0
    for f in sorted(os.listdir(d)):
        if not f.endswith(".json") or f.startswith("_"):
            continue
        slug = f[:-5]
        p = E.load_params(slug)
        over = sorted(k for k, v in json.load(open(os.path.join(d, f))).items()
                      if not k.startswith("_") and k not in
                      ("slug", "source", "canvas_cm", "tiles", "tile"))
        try:
            E.check_params(p)
            print(f"  ok      {f}" + (f"   overrides: {', '.join(over)}" if over else ""))
        except SystemExit as e:
            print(f"  BROKEN  {f}: {e}")
            bad += 1
    return bad


def stale_blobs():
    """Blobs older than the code that made them.

    The header records the source's hash and the params' hash, so staleness is
    a fact about the artifact rather than a timestamp -- which is right, and
    misses one case entirely. **The pipeline itself is not in either hash.**
    M6 found `strokes/m2/selfportrait-canvas.bin` claiming to be up to date and
    carrying M2's stroke order: M4 fixed a colour decode inside order.py, that
    canvas was not in any station, nobody rebuilt it, and its source and params
    had not moved so nothing said a word. Its golden then moved the day it
    entered station 2, by 0.0017 colour and 0.0057 relief, which is a
    measurement of M4's own fix on the last canvas that could still show it.

    Hashing the tools into the header would catch it properly and would rebuild
    thirty canvases to install. This is the cheap version and it says so: a
    modification time, compared against the newest of the tools that write a
    blob. It is a warning and not a gate, because a checkout resets mtimes.
    """
    tools = [os.path.join(ROOT, "tools", f) for f in
             ("extract.py", "order.py", "place.py", "curl.py", "shell.py",
              "room.py", "pack.py")]
    newest = max(os.path.getmtime(t) for t in os.path.exists(tools[0]) and tools)
    out = []
    for d in sorted(os.listdir(os.path.join(ROOT, "strokes"))):
        dd = os.path.join(ROOT, "strokes", d)
        if not os.path.isdir(dd) or d == "golden":
            continue
        for f in sorted(os.listdir(dd)):
            if f.endswith(".bin") and os.path.getmtime(os.path.join(dd, f)) < newest:
                out.append(f"strokes/{d}/{f}")
    return out


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
    ap.add_argument("--out", default="strokes/m3")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--golden", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--no-order", action="store_true",
                    help="leave M1's heuristic sequence in place")
    ap.add_argument("--no-place", action="store_true",
                    help="do not ask the canvas where it stands")
    ap.add_argument("--no-curl", action="store_true",
                    help="do not ask how far a stroke can move")
    ap.add_argument("--shell", default=None, metavar="STATION",
                    help="bake the per-stroke depth this station authors for it")
    ap.add_argument("--room", default=None, metavar="STATION",
                    help="ask where this canvas's straight marks point, and build "
                         "the room the station authors from it")
    a = ap.parse_args()

    if a.check or not a.slug:
        print("params discipline:")
        bad = check_all()
        old = stale_blobs()
        if old:
            print(f"\nolder than the tools that write them ({len(old)}), which the "
                  "header cannot see:")
            for f in old:
                print(f"  {f}")
        raise SystemExit(1 if bad else 0)

    from PIL import Image
    p = E.load_params(a.slug)
    E.check_params(p)
    src = os.path.join(ROOT, p["source"])
    name = a.tile or "canvas"
    stem = os.path.join(ROOT, a.out, f"{a.slug}-{name}")

    want = (E.file_sha256(src), E.params_hash(p))
    have = blob_hashes(stem + ".bin")
    if a.force or have != want:
        why = "forced" if a.force else ("no blob yet" if have is None else
                                        "source" if have[0] != want[0] else "params")
        # A rebuild that drops a stage is a valid blob with a hole in it. `shell`
        # and `room` are the two stages whose input is a station file rather than
        # a params file, so they only run when asked -- and asking is a flag a
        # person types. Rebuilding the olive grove without --shell produces twenty
        # thousand strokes with no depth on any of them, and nothing downstream
        # complains: the station just quietly stops having a middle distance. M6
        # came within about four seconds of doing exactly that to four canvases
        # at once. Only a build can drop a stage, so checking a golden against a
        # blob that is up to date needs no flag.
        for stage, flag in (("shell", a.shell), ("room", a.room)):
            if flag or not os.path.exists(stem + ".json"):
                continue
            if stage in json.load(open(stem + ".json")):
                raise SystemExit(
                    f"{a.slug}/{name} already carries `{stage}`, and this build would "
                    f"drop it.\n  Pass --{stage} <station file>, or delete the blob "
                    f"first if that is what you mean.")
        print(f"building {a.slug}/{name}  ({why} changed)")
        args = ["tools/extract.py", a.slug, "--out", a.out]
        if a.tile:
            args += ["--tile", a.tile]
        run(*args)
        if not a.no_order:
            run("tools/order.py", stem + ".json")
        if not a.no_place:
            run("tools/place.py", stem + ".json")
        if not a.no_curl:
            run("tools/curl.py", stem + ".json")
        if a.shell:
            run("tools/shell.py", stem + ".json", a.shell)
        if a.room:
            run("tools/room.py", stem + ".json", a.room)
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
