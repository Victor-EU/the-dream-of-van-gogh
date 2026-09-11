#!/usr/bin/env python3
"""A frame and a set of numbers from the runtime, out of headless Chrome.

Inherited from the sibling project's log, which paid for this lesson: the
browser pane is usually hidden, which pauses requestAnimationFrame and throttles
the CPU, so **timings taken from it are worthless**. These come from headless
Chrome with the Metal backend, against ?still so the frame is reproducible.

Getting a number and a frame out of headless Chrome is the awkward part, and
both obvious levers are wrong. --virtual-time-budget fast-forwards the clock,
which is the quantity being measured. --screenshot is a one-shot that fires as
soon as the page loads and then exits, before the frame timer has anything in
it. So instead: this script serves the page, ?probe=N tells the page to run for
N real milliseconds and then POST /__probe with window.vg.state and its own
canvas, and Chrome is killed once that arrives. The frame is captured by the
thing being measured, at a time it chose, on a real clock. No protocol client
and no extra dependency.

    tools/shot.py                                   # default view, numbers only
    tools/shot.py --url "index.html?debug&tau=0.5" --out frame.png
    tools/shot.py --size 2560x1440 --dpr 2 --probe 4000
"""
import argparse, base64, http.server, json, os, socket, socketserver
import subprocess, sys, tempfile, threading, time, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/usr/bin/google-chrome", "/usr/bin/chromium")

probe = {}
done = threading.Event()


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        rel = urllib.parse.urlparse(path).path.lstrip("/")
        return os.path.join(ROOT, urllib.parse.unquote(rel))

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        try:
            probe.update(json.loads(self.rfile.read(n) or b"{}"))
        except Exception as e:
            probe["error"] = str(e)
        done.set()
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


def chrome():
    for c in CHROME:
        if os.path.exists(c):
            return c
    raise SystemExit("no Chrome found; install it or edit CHROME in tools/shot.py")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="index.html?debug&still")
    ap.add_argument("--out", default=None)
    ap.add_argument("--size", default="2560x1440")
    ap.add_argument("--dpr", type=float, default=2.0)
    ap.add_argument("--probe", type=int, default=3500, help="real ms before reading")
    ap.add_argument("--wav", default=None,
                    help="write what the brush played here -- the url needs ?sound&soundlog")
    a = ap.parse_args()

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    sep = "&" if "?" in a.url else "?"
    extra = "" if a.out else "&nopng"
    url = f"http://127.0.0.1:{port}/{a.url}{sep}probe={a.probe}{extra}"
    prof = tempfile.mkdtemp()
    cmd = [chrome(), "--headless=new", "--use-angle=metal", "--enable-gpu",
           "--hide-scrollbars", "--disable-lcd-text", "--mute-audio",
           # the brush is off by default and a browser will not start sound
           # without a gesture; the harness has no hands
           "--autoplay-policy=no-user-gesture-required",
           "--no-first-run", "--no-default-browser-check",
           f"--user-data-dir={prof}", f"--window-size={a.size.replace('x', ',')}",
           f"--force-device-scale-factor={a.dpr}", url]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    got = done.wait(timeout=a.probe / 1000 + 30)
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
    srv.shutdown()
    if os.environ.get("SHOT_VERBOSE"):
        print((proc.stderr.read() or b"").decode("utf-8", "replace")[-3000:], file=sys.stderr)

    if not got or not probe:
        print("no probe came back: the page did not reach window.vg. "
              "Open the url in a browser and look.", file=sys.stderr)
        print(url, file=sys.stderr)
        raise SystemExit(1)
    png = probe.pop("png", None)
    wav = probe.pop("wav", None)
    print(json.dumps(probe.get("state", probe), indent=2, sort_keys=True))
    if a.out and png:
        with open(a.out, "wb") as f:
            f.write(base64.b64decode(png.split(",", 1)[1]))
        print(f"-> {a.out}", file=sys.stderr)
    if a.wav and wav and wav.get("b64"):
        with open(a.wav, "wb") as f:
            f.write(base64.b64decode(wav["b64"]))
        print(f"-> {a.wav}", file=sys.stderr)


if __name__ == "__main__":
    main()
