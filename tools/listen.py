#!/usr/bin/env python3
"""What the brush sounds like, as numbers and as a file a person can listen to.

M7's exit criterion for the sound is two sentences -- with sound on, a burst is
felt; when it ends, the silence is enormous -- and neither is a fact until it is
measured. This plays one station through headless Chrome from bare canvas with
the brush on, keeps what came out of it, and says three things:

  - how loud a burst is, in dBFS RMS, with the rate the strokes were arriving at;
  - how long the output takes to fall to nothing once the last stroke of an act
    has arrived, and whether nothing is exactly zero or only quiet -- a hold is
    DESIGN 5.2's punctuation between two acts, and it is where the silence is;
  - which way it came from: the output's left-right balance against the side of
    the head the arriving paint was on, frame by frame. DESIGN 10 says the roar
    comes from the direction the paint is arriving from, and this is the check.

It writes the WAV and a picture of its envelope beside it, because a number is
not what the viewer hears.

    tools/listen.py                               # station 4, twenty seconds
    tools/listen.py --station 6 --seconds 30 --out s06.wav
"""
import argparse, base64, json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable


def db(x):
    return 20 * np.log10(max(float(x), 1e-12))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--station", type=int, default=4)
    ap.add_argument("--seconds", type=float, default=20)
    ap.add_argument("--out", default=None, help="the WAV; a PNG of its envelope goes beside it")
    ap.add_argument("--url", default=None, help="play this instead of a station from bare canvas")
    ap.add_argument("--again", action="store_true",
                    help="measure the WAV and the page's log from the last run instead of playing it again")
    a = ap.parse_args()
    out = a.out or os.path.join(ROOT, "strokes", f"listen-s{a.station:02d}.wav")
    url = a.url or (f"index.html?station={a.station}&tau=0&play&sound&soundlog"
                    f"&soundsecs={a.seconds + 3:g}")
    saved = os.path.splitext(out)[0] + ".json"
    if a.again:
        state = json.load(open(saved))
    else:
        r = subprocess.run([PY, os.path.join(ROOT, "tools", "shot.py"), "--url", url,
                            "--probe", str(int(a.seconds * 1000)), "--size", "960x600", "--dpr", "1",
                            "--wav", out], capture_output=True, text=True, cwd=ROOT)
        if r.returncode or not os.path.exists(out):
            print(r.stdout[-2000:], r.stderr[-2000:], file=sys.stderr)
            raise SystemExit("no sound came back: is the brush on, and did the page reach window.vg?")
        state = json.loads(r.stdout[r.stdout.index("{"):r.stdout.rindex("}") + 1])
        json.dump(state, open(saved, "w"))
    au = state.get("audio") or {}
    log = au.get("log") or []
    with wave.open(out) as w:
        sr, n = w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), np.int16).reshape(-1, 2).astype(np.float64) / 32767.0
    t0 = au.get("t0") or 0.0
    print(f"{out}\n  {n / sr:.1f} s at {sr} Hz, stereo; context {au.get('running')}, "
          f"{len(log)} frames logged")
    if not log:
        raise SystemExit("the page logged no frames: was ?soundlog on?")

    # frame by frame: [context time, strokes arrived, rate a second, azimuth, target dB]
    T = np.array([f[0] for f in log]); N = np.array([f[1] for f in log]); R = np.array([f[2] for f in log])
    AZ = np.array([np.nan if f[3] is None else f[3] for f in log])
    idx = lambda t: int(np.clip(round((t - t0) * sr), 0, len(x)))

    # 1. the burst
    burst = R >= 1000
    seg = [x[idx(T[i]):idx(T[i + 1])] for i in range(len(T) - 1) if burst[i]]
    if seg:
        s = np.concatenate(seg)
        rms, peak = np.sqrt(np.mean(s ** 2)), np.abs(s).max()
        print(f"\na burst: {burst.sum()} frames at >= 1,000 strokes a second, median "
              f"{np.median(R[burst]):,.0f}/s -- {db(rms):.1f} dBFS RMS, peak {db(peak):.1f} dBFS")
    else:
        print("\nno frame reached 1,000 strokes a second: nothing here is a burst")

    # The recording and the page keep one clock, the context's, and this is how
    # well they agree: from the first stroke the page logged to the first sound.
    first = next((k for k in range(len(T)) if N[k] > 0), None)
    loud = np.nonzero(np.abs(x).max(axis=1) > 0)[0]
    if first is not None and len(loud):
        print(f"\nthe first sound is {(loud[0] / sr - (T[first] - t0)) * 1000:+.0f} ms from the first stroke")

    # 2. the silence: every stretch of a second or more with nothing arriving, from
    # the act's last stroke to a little before the next act's first, so that the
    # next act's own attack is not counted as the hold failing to be silent
    print("\nthe silence after each act (a hold is 2.4 s):")
    falls, i = [], 0
    while i < len(T):
        if N[i] > 0:
            j = i
            while j + 1 < len(T) and N[j + 1] == 0:
                j += 1
            if j + 1 < len(T) and T[j + 1] - T[i] >= 1.0:
                b0, b1 = idx(T[i]), idx(T[j + 1]) - int(0.06 * sr)
                hold = np.abs(x[b0:b1]).max(axis=1)
                nz = np.nonzero(hold > 0)[0]
                fall = (nz[-1] + 1) / sr if len(nz) else 0.0
                span = (b1 - b0) / sr
                falls.append(fall)
                print(f"  at {T[i] - t0:6.2f} s: {span:.2f} s with nothing arriving, and the output is "
                      f"exactly zero from {fall * 1000:3.0f} ms after the last stroke to the next act")
            i = j + 1
        else:
            i += 1
    if falls:
        print(f"  {len(falls)} holds: exact zero {np.median(falls) * 1000:.0f} ms after the last stroke "
              f"at the median, {max(falls) * 1000:.0f} ms at the most")

    # 3. which way
    side = []
    for k in range(len(T) - 1):
        if N[k] <= 0 or np.isnan(AZ[k]) or abs(AZ[k]) < 20:
            continue
        s = x[idx(T[k]):idx(T[k + 1])]
        if len(s) < 16:
            continue
        L, Rr = np.sqrt(np.mean(s[:, 0] ** 2)), np.sqrt(np.mean(s[:, 1] ** 2))
        if L + Rr > 0:
            side.append((AZ[k], db(Rr) - db(L)))
    if side:
        s = np.array(side)
        agree = np.mean(np.sign(s[:, 0]) == np.sign(s[:, 1]))
        right, left = s[s[:, 0] > 0], s[s[:, 0] < 0]
        print(f"\nwhich way: {len(s)} frames with the paint arriving 20 degrees or more off centre; "
              f"the louder ear is the paint's side in {agree * 100:.0f}% of them")
        if len(right):
            print(f"  paint on the right ({np.median(right[:, 0]):+.0f} deg median): right ear "
                  f"{np.median(right[:, 1]):+.1f} dB over the left")
        if len(left):
            print(f"  paint on the left ({np.median(left[:, 0]):+.0f} deg median): right ear "
                  f"{np.median(left[:, 1]):+.1f} dB over the left")
    else:
        print("\nwhich way: the paint never arrived more than 20 degrees off centre in this run")

    # and a picture of it, since the numbers are not what the viewer hears
    try:
        from PIL import Image, ImageDraw
        W, H, hop = 1400, 360, max(1, sr // 100)
        env = [db(np.sqrt(np.mean(x[k:k + hop] ** 2))) if np.any(x[k:k + hop]) else -120
               for k in range(0, len(x), hop)]
        img = Image.new("RGB", (W, H), (14, 13, 18)); d = ImageDraw.Draw(img)
        for lvl in (-20, -40, -60, -80):
            y = int(-lvl / 100 * (H - 20)) + 10
            d.line([(0, y), (W, y)], fill=(40, 40, 46)); d.text((4, y - 12), f"{lvl} dB", fill=(90, 90, 96))
        for k, e in enumerate(env):
            X = int(k / len(env) * W); y = int(min(1, -e / 100) * (H - 20)) + 10
            d.line([(X, H - 10), (X, y)], fill=(232, 228, 220) if e > -119 else (14, 13, 18))
        rmax = max(R.max(), 1)
        pts = [(int(((t - t0) * sr) / len(x) * W), int(H - 10 - (H - 40) * np.log10(1 + r) / np.log10(1 + rmax)))
               for t, r in zip(T, R)]
        d.line(pts, fill=(200, 120, 60), width=1)
        d.text((W - 380, 12), "white: output level     orange: strokes arriving, log scale", fill=(150, 150, 150))
        png = os.path.splitext(out)[0] + ".png"
        img.save(png)
        print(f"\n-> {png}")
    except ImportError:
        pass


if __name__ == "__main__":
    main()
