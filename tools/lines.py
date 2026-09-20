#!/usr/bin/env python3
"""His words for this piece, checked against the edition before they ship (DESIGN 9).

The sibling's tools/letters.py is the checker, and it is kept here whole; this is the same check asked of this
piece's four lines rather than of that one's ten stations. Nothing here types a word of his from memory: it
fetches the letter, finds every fragment of the line in the paragraph named, verbatim and in order, and refuses
a line that starts or stops inside a sentence without an ellipsis to say so. Where the line stands at a canvas,
the edition's own note has to identify that canvas -- by the holder's name, the title and the size, all three --
and where no note does, the `why` has to say why the line stands there and nothing cited around it may name a
canvas this piece has.

It writes letters/letters.json, which is what a stranger checks.

    tools/lines.py              # check every line, write the record
    tools/lines.py --check      # check only; exit 1 if anything is wrong or the record is stale
    tools/lines.py --refresh    # ask the edition again rather than the cache
"""
import argparse, datetime, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import letters as LT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(ROOT, 'letters', 'lines.json')
RECORD = os.path.join(ROOT, 'letters', 'letters.json')


def check(entry, cvs, refresh):
    L = entry['letter']
    n = str(L['n'])
    bad, say = [], []
    meta = LT.metadata(n, refresh)
    tr = LT.paragraphs(LT.get(LT.PAGE.format(n=n, kind='translation'), refresh))
    og = LT.paragraphs(LT.get(LT.PAGE.format(n=n, kind='original_text'), refresh))
    nt = LT.notes(LT.get(LT.PAGE.format(n=n, kind='notes'), refresh))
    k, text, english = L.get('para'), L.get('text') or '', L.get('lang') == 'en'
    src = og if english else tr
    where = 'his original' if english else 'the translation'

    if not isinstance(k, int) or not 0 <= k < len(src):
        bad.append(f'paragraph {k} is not in {where} of letter {n}, which has {len(src)}')
        para = ''
    else:
        para = src[k][0]
        spans, missing = LT.find(text, para)
        if missing is not None:
            bad.append(f"not in paragraph {k} of {where}: '{missing}'")
        elif spans:
            before, after = para[:spans[0][0]].rstrip(), para[spans[-1][1]:].lstrip()
            if not text.lstrip().startswith('…') and before and before[-1] not in '.!?’”:;':
                bad.append('starts inside a sentence without an ellipsis to say so')
            if not text.rstrip().endswith('…') and after and text.rstrip()[-1] not in '.!?’”':
                bad.append('stops inside a sentence without an ellipsis to say so')
    words = len(re.findall(r"[\w’'-]+", text))
    if words > LT.LONG:
        say.append(f'{words} words: more than a line, and DESIGN 9 fades it after seconds')

    cv = cvs.get(entry.get('canvas')) if entry.get('canvas') else None
    if entry.get('canvas') and not cv:
        bad.append(f"canvas '{entry['canvas']}' is not one of {', '.join(cvs)}")
    ident = None
    near = range(max(0, (k or 0) - LT.NEAR), min(len(tr), (k or 0) + LT.NEAR + 1))
    cited = {nid: i for i in near for nid in tr[i][1]} if isinstance(k, int) else {}
    if L.get('note'):
        note = nt.get(L['note'])
        hit = [w for w in (note or {}).get('works', []) if cv and LT.same(w, cv)]
        if not note:
            bad.append(f"letter {n} has no note {L['note']}")
        elif L['note'] not in cited:
            bad.append(f"note {L['note']} is not cited within {LT.NEAR} paragraphs of the line")
        elif not hit:
            bad.append(f"note {L['note']} identifies " +
                       ('; '.join(f"{w['title']} (F {w['F']}), {w['credit']}" for w in note['works'])
                        or 'no work of his') + f" -- not {cv['title'] if cv else 'this canvas'}")
        else:
            w = hit[0]
            x, y = sorted(w['cm']), sorted(cv['cm'])
            if any(abs(p - q) > LT.CM for p, q in zip(x, y)):
                say.append(f"the edition gives {w['cm'][0]:g} x {w['cm'][1]:g} cm and the holder "
                           f"{cv['cm'][0]:g} x {cv['cm'][1]:g} cm: one object, two measurements")
            ident = dict(note=L['note'], paragraph=cited[L['note']], work=w['title'], F=w['F'], JH=w['JH'],
                         cm=w['cm'], credit=w['credit'],
                         also=[f"{x['title']} (F {x['F']})" for x in note['works'] if x is not w])
    else:
        if not L.get('why'):
            bad.append('no note identifies the canvas and there is no `why`')
        for nid in cited:
            for w in nt.get(nid, {}).get('works', []):
                for c in cvs.values():
                    if LT.same(w, c):
                        bad.append(f"the edition's note {nid} says this passage is about {c['title']}: "
                                   f'name it rather than explaining it away')

    orig = og[k][0] if isinstance(k, int) and 0 <= k < len(og) else None
    if orig is not None and not english and tr[k][1] and og[k][1] and tr[k][1] != og[k][1]:
        say.append(f"the original's paragraph {k} cites other notes than the translation's")

    rec = {'id': entry['id'], 'title': entry['title'], 'letter': int(n), 'to': meta['to'],
           'place': meta['place'], 'date': meta['date'],
           'concordance': {'Br. 1990': meta['Br. 1990'], 'CL': meta['CL']},
           'paragraph': k, 'from': 'the original, which he wrote in English' if english else 'the translation',
           'text': text, 'words': words, 'original': orig,
           'canvas': entry.get('canvas'), 'identified': ident, 'why': L.get('why'),
           'links': {'translation': f'{LT.SITE}/en/let{n}', 'original': f'{LT.SITE}/orig/let{n}'}}
    return rec, bad, say, meta


def main():
    ap = argparse.ArgumentParser(description="Check this piece's lines against vangoghletters.org.")
    ap.add_argument('--check', action='store_true', help='write nothing; exit 1 if anything is wrong or stale')
    ap.add_argument('--refresh', action='store_true', help='ask the edition again rather than the cache')
    a = ap.parse_args()

    spec = json.load(open(SPEC))
    cvs = spec['canvases']
    home = LT.get(LT.SITE + '/vg/', a.refresh)
    version = (re.search(r'Version:\s*([A-Z][a-z]+ \d{4})', LT.clean(home)) or [None, 'unknown'])[1]
    out, nbad = [], 0
    for entry in spec['lines']:
        rec, bad, say, meta = check(entry, cvs, a.refresh)
        print(f"\n{entry['id']}  letter {rec['letter']} to {rec['to']}, {rec['place']}, {rec['date']}")
        print(f"  “{rec['text']}”  ({rec['words']} words, paragraph {rec['paragraph']} of {rec['from']})")
        if rec['identified']:
            i = rec['identified']
            print(f"  the edition's note {i['note']} identifies {i['work']} (F {i['F']} / JH {i['JH']}), "
                  f"{i['cm'][0]:g} x {i['cm'][1]:g} cm, {i['credit']}")
        for s in say:
            print('  note:', s)
        for b in bad:
            print('  WRONG:', b)
        nbad += len(bad)
        out.append(rec)
    doc = {'_about': 'DESIGN 9. Checked by tools/lines.py against the edition; see letters/lines.json for what was asked.',
           'edition': {'cite': LT.CITE.format(version), 'version': version, 'licence': LT.LICENCE},
           'checked': datetime.date.today().isoformat(), 'lines': out}
    if a.check:
        old = json.load(open(RECORD)) if os.path.exists(RECORD) else None
        stale = not old or [x | {} for x in old.get('lines', [])] != out
        if stale:
            print('\nletters/letters.json is not what this check produces'); nbad += 1
    else:
        json.dump(doc, open(RECORD, 'w'), indent=1, ensure_ascii=False)
        print('\nwrote', RECORD)
    print(f"{len(out)} lines, {nbad} wrong")
    sys.exit(1 if nbad else 0)


if __name__ == '__main__':
    main()
