#!/usr/bin/env python3
"""Station 7 and the end, met by scripted hands in headless Chrome.

BUILD M8's first exit criterion is a stranger at station 7, and no script is
one. What a script can say is whether the mechanism does what DESIGN 7 says
before anybody is put in front of it -- because a refusal a hand can slip past,
or a silence with a tail on it, would be tested on people and found wanting for
a reason that is not the design's. So: every way forward, met at the gate, and
every one of them held there for the beat and no longer; the brush cut to exact
zero at the stop, in the middle of a burst; the playing itself stopping at the
last stroke of the last field and not at the end; and the end reached by a
hand, held, and then the crows.

  play    space, from the start of station 7: the canvas paints to its stop,
          the brush is cut, the scrub holds for the beat and goes on by itself
  hold    the right arrow held down into the gate and on to the end
  wheel   a wheel turned forward four times a second into the gate
  jump    one click on the band from station 5 to Auvers, which lands on the
          gate instead of Auvers
  end     space, from the start of station 10: the rush, and then nothing plays
  after   a hand from station 10 to the end, and what is there before and after
          the nothing has been held

    tools/beat.py              # all of them
    tools/beat.py play hold    # some
"""
import argparse, json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
OUT = os.path.join(ROOT, "strokes", "beat")
FRAME = 0.05                 # the loop clamps a frame to this, so it is the slack on any timing


def run(url, ms, wav=None):
    cmd = [PY, os.path.join(ROOT, "tools", "shot.py"), "--url", url, "--probe", str(ms),
           "--size", "960x600", "--dpr", "1"]
    if wav:
        cmd += ["--wav", wav]
    # twice: headless Chrome very occasionally never answers at all -- M8's first
    # full run lost one scenario that way, and it passed on its own straight
    # after -- and a second try tells that apart from a page that is broken
    for attempt in (1, 2):
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
        if not r.returncode and "{" in r.stdout:
            return json.loads(r.stdout[r.stdout.index("{"):r.stdout.rindex("}") + 1])
    print(r.stdout[-1500:], r.stderr[-1500:], file=sys.stderr)
    raise SystemExit(f"no state came back from {url}, twice")


def at_gate(state):
    """When tau first stood on the gate, how long it stayed, and whether it was
    ever past the gate before it got there."""
    g = state["gates"][0]
    tr = np.array(state.get("trace") or [[0, 0]])
    t, x = tr[:, 0], tr[:, 1]
    on = np.abs(x - g["tau"]) < 1e-6
    if not on.any():
        return None, None, bool((x > g["tau"] + 1e-6).any())
    i0 = int(np.argmax(on)); i1 = i0
    while i1 + 1 < len(on) and on[i1 + 1]:
        i1 += 1
    return float(t[i0]), float(t[i1] - t[i0]), bool((x[:i0] > g["tau"] + 1e-6).any())


class Report:
    def __init__(self):
        self.rows, self.bad = [], 0

    def check(self, name, what, ok, got):
        self.rows.append((name, what, "ok" if ok else "WRONG", got))
        self.bad += 0 if ok else 1

    def show(self):
        w = max(len(r[1]) for r in self.rows)
        for n, what, ok, got in self.rows:
            print(f"  {n:6s} {what:{w}s}  {ok:5s}  {got}")


def play(R):
    wav = os.path.join(OUT, "play.wav")
    st = run("index.html?begin=7&play&trace&sound&soundlog&soundsecs=16&nopng", 13000, wav)
    g = st["gates"][0]
    arr = g["arrivals"][0] if g["arrivals"] else {}
    t0, held, early = at_gate(st)
    R.check("play", "arrived at the gate by playing", arr.get("how") == "play", arr.get("how"))
    R.check("play", "never past the gate before it", t0 is not None and not early, f"first on it at {t0}")
    R.check("play", f"held there for the beat, {g['refuse']} s", held is not None and abs(held - g["refuse"]) <= 2 * FRAME,
            f"{held:.3f} s" if held is not None else "never")
    R.check("play", "then went on by itself", g["state"] == "open" and st["tau"] > g["tau"] + 1e-6,
            f"tau {st['tau']:.5f}, gate {g['state']}")
    au = st.get("audio") or {}
    cuts, log = au.get("cuts") or [], au.get("log") or []
    R.check("play", "the brush was cut, once", len(cuts) == 1, f"{len(cuts)} cut(s)")
    if not cuts or not os.path.exists(wav):
        return
    cut = cuts[0]
    before = [f for f in log if f[0] <= cut]
    rate = before[-1][2] if before else 0
    R.check("play", "and in the middle of a burst", rate >= 500, f"{rate} strokes a second arriving")
    with wave.open(wav) as w:
        sr, n = w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), np.int16).reshape(-1, 2)
    zero = (x[:, 0] == 0) & (x[:, 1] == 0)
    i = int(round((cut - au["t0"]) * sr))
    j = i
    while j < len(zero) and not zero[j:j + sr // 1000].all():
        j += 1
    end = min(len(zero), int(round((cut + g["refuse"] - au["t0"]) * sr)))
    ms = (j - i) / sr * 1000
    R.check("play", "to exact zero within 10 ms of the cut", 0 <= ms <= 10, f"{ms:.1f} ms")
    R.check("play", "and zero for the whole beat", j < end and bool(zero[j:end].all()),
            f"{(end - j) / sr:.2f} s of it, {int((~zero[j:end]).sum())} samples not zero")


def hold(R):
    st = run("index.html?begin=7&hand=hold&handsec=13&handat=600&trace&nopng", 15500)
    g = st["gates"][0]
    arr = g["arrivals"][0] if g["arrivals"] else {}
    t0, held, early = at_gate(st)
    R.check("hold", "arrived at the gate by the arrow", arr.get("how") == "key", arr.get("how"))
    R.check("hold", "never past the gate before it", t0 is not None and not early, f"first on it at {t0}")
    R.check("hold", f"held there for the beat, {g['refuse']} s", held is not None and abs(held - g["refuse"]) <= 2 * FRAME,
            f"{held:.3f} s" if held is not None else "never")
    R.check("hold", "with the arrow down the whole time", abs(arr.get("keySeconds", 0) - g["refuse"]) <= 0.2,
            f"{arr.get('keySeconds')} s held")
    R.check("hold", "and the same hand then reaches the end", st["tau"] >= 1 - 1e-9 and st["station"] == 11,
            f"tau {st['tau']:.5f}, station {st['station']}")


def wheel(R):
    st = run("index.html?begin=7&hand=wheel&handsec=9&handat=600&trace&nopng", 10500)
    g = st["gates"][0]
    arr = g["arrivals"][0] if g["arrivals"] else {}
    t0, held, early = at_gate(st)
    R.check("wheel", "arrived at the gate by the wheel", arr.get("how") == "wheel", arr.get("how"))
    R.check("wheel", f"held there for the beat, {g['refuse']} s", held is not None and abs(held - g["refuse"]) <= 0.3,
            f"{held:.3f} s" if held is not None else "never")
    want = int(g["refuse"] * 4) - 1
    R.check("wheel", "every turn in it counted as refused", abs(arr.get("pushes", 0) - want) <= 2,
            f"{arr.get('pushes')} pushes against about {want}")
    R.check("wheel", "and the next turn after it opened went on", arr.get("next") is not None and arr["next"] <= 0.3,
            f"{arr.get('next')} s after it opened")


def jump(R):
    st = run("index.html?begin=5&hand=jump&jumpto=0.95&handat=1500&trace&nopng", 9000)
    g = st["gates"][0]
    arr = g["arrivals"][0] if g["arrivals"] else {}
    R.check("jump", "a click on Auvers landed on the gate", arr.get("how") == "band" and abs(st["tau"] - g["tau"]) < 1e-6,
            f"{arr.get('how')}, tau {st['tau']:.6f} against the gate's {g['tau']:.6f}")
    R.check("jump", "and stays there once it opens", g["state"] == "open", g["state"])


def end(R):
    st = run("index.html?begin=10&play&trace&nopng", 9000)
    R.check("end", "the playing stopped at the last stroke", not st["playing"] and abs(st["tau"] - st["playEnd"]) < 1e-6,
            f"tau {st['tau']:.6f}, the field's last stroke at {st['playEnd']:.6f}, playing {st['playing']}")
    R.check("end", "which is not the end of the scrub", st["playEnd"] < 1 and st["station"] == 10,
            f"station {st['station']}")


def after(R):
    url = "index.html?begin=10&hand=hold&handsec=2&handat=600&trace&nopng"
    a = run(url, 18000)
    c = a["crows"]
    R.check("after", "a hand reaches the end", a["tau"] >= 1 - 1e-9 and a["station"] == 11,
            f"tau {a['tau']:.5f}, station {a['station']}")
    R.check("after", f"and {c['nothing']:.0f} s of nothing: no crows at {c['after']:.0f} s", c["arrived"] == 0,
            f"{c['arrived']} there")
    b = run(url, 42000)
    c = b["crows"]
    R.check("after", f"then the crows: all of them by {c['after']:.0f} s", c["arrived"] >= 9,
            f"{c['arrived']} of the end's crows there")


SCENES = {"play": play, "hold": hold, "wheel": wheel, "jump": jump, "end": end, "after": after}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("only", nargs="*")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    names = a.only or list(SCENES)
    R = Report()
    for n in names:
        if n not in SCENES:
            raise SystemExit(f"no scenario {n}; there are {', '.join(SCENES)}")
        print(f"... {n}", flush=True)
        try:
            SCENES[n](R)
        except SystemExit as e:
            # a page that never answered is a result, and the others still are
            R.check(n, "the page answered", False, str(e))
    print()
    R.show()
    print(f"\n{len(R.rows) - R.bad} of {len(R.rows)} hold" + (f"; {R.bad} do not" if R.bad else ""))
    return 1 if R.bad else 0


if __name__ == "__main__":
    sys.exit(main())
