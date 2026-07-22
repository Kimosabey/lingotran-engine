#!/usr/bin/env python
"""Build the GLOBAL combined sheets from the per-family combined sheets.

For each export type (catalog / questions / vocabulary), concatenate every
`<family>-a1-<type>-all.csv` present (goethe / netzwerk / goyal / …) into a
single `german-a1-<type>-all.csv` that spans the whole German corpus.

Read-only on the per-family files — in particular the delivered, frozen
`goethe-a1-*-all.csv` are read and never rewritten. Output is UTF-8 with BOM.

Usage:
    python _tools/merge_all.py
"""
import csv
import glob
import os

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)  # german/extracted/
TYPES = ['catalog', 'questions', 'vocabulary']


def merge(kind):
    parts = sorted(
        p for p in glob.glob(os.path.join(ROOT, '*-a1-%s-all.csv' % kind))
        if not os.path.basename(p).startswith('german-a1-')  # never read our own output
    )
    if not parts:
        print('%-11s no per-family sheets found — skipped' % kind)
        return
    header, rows, sources = None, [], []
    for p in parts:
        with open(p, encoding='utf-8-sig', newline='') as f:
            r = list(csv.reader(f))
        if not r:
            continue
        if header is None:
            header = r[0]
        rows.extend(r[1:])
        sources.append('%s(%d)' % (os.path.basename(p).split('-a1-')[0], len(r) - 1))
    out = os.path.join(ROOT, 'german-a1-%s-all.csv' % kind)
    with open(out, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print('%-11s -> german-a1-%s-all.csv  (%d rows: %s)' % (kind, kind, len(rows), ' + '.join(sources)))


if __name__ == '__main__':
    for k in TYPES:
        merge(k)
