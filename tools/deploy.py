#!/usr/bin/env python3
"""Put the committed tree on the live site, with every script at an address that changes when the script does.

The site is https://the-world-of-van-gogh.telbase.ai: Telbase, deploying to Vercel. That host revalidates the page on
every visit but sends each `.js` with `max-age=31536000, immutable`, so a browser that has been here before gets
the new page and runs its last visit's scripts without asking for them again. That is how the speed button came up
in the corner on 16 Sep 2026 and neither it nor X did anything (BUILD.md, After M9 — The scripts a browser keeps).

So the page as deployed asks for each script by its content, `src/ui.js?v=<the first 10 hex of its sha1>`. The two
script tags carry the stamp, and the import map carries it for every module, so the imports inside `src/` keep
their plain relative names and the repository's page runs unstamped from any local server. A script that has not
changed keeps its address, and its copy in the cache.

The underlayers (`.png`, a year and immutable too) and the stroke records (`.bin`, four hours) are not stamped:
none has changed since the first deploy. A canvas solved again would need the same treatment.

    python3 tools/deploy.py                                # export HEAD, stamp it, deploy it
    python3 tools/deploy.py --dry-run --out /tmp/vgu-site  # export and stamp only, to read or serve
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# in the repository but never loaded by the page; strokes/golden alone is 57 MB, and 69 MB did not upload
LEAVE_OUT = ['.claude', 'tools', 'ref', 'strokes/golden']


def export(rev, out):
    if out.exists() and any(out.iterdir()):
        if (out / '.git').exists() or out in (ROOT, *ROOT.parents) or not (out / 'index.html').exists():
            sys.exit(f'{out} is not empty and is not an earlier export; give an empty or new folder')
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    git = subprocess.Popen(['git', '-C', str(ROOT), 'archive', rev], stdout=subprocess.PIPE)
    subprocess.run(['tar', '-x', '-C', str(out)], stdin=git.stdout, check=True)
    git.stdout.close()
    if git.wait():
        sys.exit(f'git archive {rev} failed')
    for p in LEAVE_OUT:
        shutil.rmtree(out / p, ignore_errors=True)


def stamp(site):
    src = site / 'src'
    v = {p.name: hashlib.sha1(p.read_bytes()).hexdigest()[:10] for p in sorted(src.glob('*.js'))}
    # the import map reaches only what is imported as ./<a file in src/>
    relative = re.compile(r'''^\s*(?:import|export)\b[^;]*?['"](\.{1,2}/[^'"]*)['"]''', re.M)
    for p in sorted(src.glob('*.js')):
        for spec in relative.findall(p.read_text(encoding='utf-8')):
            if not (spec.startswith('./') and spec[2:] in v):
                sys.exit(f'src/{p.name} imports {spec}, which the import map would not stamp')

    page = site / 'index.html'
    html = page.read_text(encoding='utf-8')

    def once(old, new):
        nonlocal html
        if html.count(old) != 1:
            sys.exit(f'index.html: expected {old} once, found it {html.count(old)} times')
        html = html.replace(old, new)

    once('<script src="src/veil.js">', f'<script src="src/veil.js?v={v["veil.js"]}">')
    once('<script type="module" src="src/main.js">', f'<script type="module" src="src/main.js?v={v["main.js"]}">')
    m = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
    if not m:
        sys.exit('index.html: no import map')
    imports = json.loads(m.group(1)).get('imports', {})
    # veil.js is a classic script and is never imported; its worker is started from the script's own stamped address
    imports.update({f'./src/{n}': f'./src/{n}?v={h}' for n, h in v.items() if n != 'veil.js'})
    body = json.dumps({'imports': imports}, indent=1, ensure_ascii=False)
    html = html[:m.start(1)] + '\n' + body + '\n' + html[m.end(1):]
    page.write_text(html, encoding='utf-8')
    return v


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--rev', default='HEAD', help='the commit to deploy (default HEAD)')
    ap.add_argument('--out', type=Path, help='where to export (default a new temporary folder)')
    ap.add_argument('--dry-run', action='store_true', help='export and stamp, and do not deploy')
    a = ap.parse_args()

    commit = subprocess.run(['git', '-C', str(ROOT), 'log', '-1', '--format=%h %s', a.rev],
                            check=True, capture_output=True, text=True).stdout.strip()
    site = (a.out or Path(tempfile.mkdtemp(prefix='vgu-deploy-'))).resolve()
    export(a.rev, site)
    v = stamp(site)
    print(f'{commit}\n{site}')
    for n, h in v.items():
        print(f'  src/{n:<12} ?v={h}')
    if a.dry_run:
        return

    link = ROOT / '.telbase' / 'project.json'   # the project link: untracked, so it is not in the export
    if not link.exists():
        sys.exit('no .telbase/project.json in the repository: the Telbase project is not linked here')
    (site / '.telbase').mkdir(exist_ok=True)
    shutil.copy(link, site / '.telbase' / 'project.json')
    env = dict(os.environ, PATH=f'{Path.home() / ".local" / "bin"}:{os.environ.get("PATH", "")}')
    telbase = ['pnpm', 'dlx', 'telbase', 'deploy', '--local', '--provider', 'vercel', '--auto']
    subprocess.run(telbase, cwd=site, env=env, check=True)


if __name__ == '__main__':
    main()
