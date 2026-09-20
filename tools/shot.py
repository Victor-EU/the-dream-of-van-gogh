#!/usr/bin/env python3
"""Headless screenshots and the three fixed flights, for the log (BUILD.md, the harness).

Opens the page in headless Chromium through Playwright, waits for `dream.ready`, runs whatever JavaScript it is
given, and either writes a screenshot or runs one of the fixed flights and prints its frame rates as JSON. The
frame rate in headless Chromium is software-rendered and is not the number the budget is about; the flights are
run here for their screenshots and their state, and timed in a real browser (the log says which).

    tools/shot.py --out shots/standpoint.png --url 'http://127.0.0.1:8712/?test&notitle'
    tools/shot.py --js 'dream.go({pos:[0,80,-200], yaw:20, pitch:-10})' --out shots/village.png
    tools/shot.py --flight swoop --out shots/swoop.png
"""
import argparse, json, sys, time
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8712/?notitle')
    ap.add_argument('--out')
    ap.add_argument('--js', action='append', default=[])
    ap.add_argument('--eval', action='append', default=[], help='print the value of an expression, after --js')
    ap.add_argument('--flight')
    ap.add_argument('--dwell', action='store_true', help='with --flight: also run the parting test (DESIGN 6.5)')
    ap.add_argument('--wait', type=float, default=1.5)
    ap.add_argument('--timeout', type=float, default=180)
    ap.add_argument('--width', type=int, default=1200)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--at', type=float, action='append', default=[], help='also a screenshot at these seconds of the piece\'s clock, after --js')
    a = ap.parse_args()
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': a.width, 'height': a.height}, device_scale_factor=a.scale)
        pg.set_default_timeout(a.timeout * 1000)   # a big frame in swiftshader can take much longer than 30 s
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(a.url)
        pg.wait_for_function('window.dream && window.dream.ready', timeout=60000)
        for js in a.js:
            pg.evaluate(js)
        for ex in a.eval:
            print(ex, '->', json.dumps(pg.evaluate(f'(async () => ({ex}))()')))
        if a.flight:
            pg.set_default_timeout(a.timeout * 1000)
            r = pg.evaluate(f'dream.flight({json.dumps(a.flight)}, {{dwell: {str(a.dwell).lower()}}})')
            print(json.dumps(r))
        elif a.at:
            t0 = pg.evaluate('dream.state().time')
            for T in a.at:
                st = pg.evaluate(f'dream.wait({T + t0} - dream.state().time)')
                out = a.out.replace('.png', f'-{T:g}s.png')
                pg.screenshot(path=out)
                print('wrote', out, json.dumps(st))
        else:
            time.sleep(a.wait)
        if a.out and not a.at:
            pg.screenshot(path=a.out)
            print('wrote', a.out, json.dumps(pg.evaluate('dream.state()')))
        if errors:
            print('errors:', *errors, sep='\n  ', file=sys.stderr)
        b.close()


if __name__ == '__main__':
    main()
