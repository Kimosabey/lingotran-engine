#!/usr/bin/env python
"""Verify an agent-run backfill against git HEAD, before trusting it.

Closes gap A3. "Disk truth over agent-claimed truth" is mechanism #4 in
PLAYBOOK.md, but enforcing it was a PRACTICE, not a tool: every wave of the
2026-08-10 rubric and translation backfills was checked with a throwaway script
written in a temp directory and thrown away afterwards. That works exactly as
long as the next person remembers to write it again.

What it asserts, per file, for a named added field:
  1. the record count is unchanged;
  2. every record now carries the field;
  3. NOTHING ELSE CHANGED -- compares parsed JSON field by field, so a re-indent
     or key reordering is not mistaken for drift (agents legitimately rewrite
     whole files);
  4. reports how many records got a non-empty value, since an agent can add an
     empty key everywhere and technically satisfy 1-3.

Handles both record shapes in this repo: `items` (questions/classification) and
`entries` (vocabulary).

Usage:
    python _engine/verify_backfill.py --root french/extracted --field instruction
    python _engine/verify_backfill.py --root german/extracted --field instruction
    python _engine/verify_backfill.py --root french/extracted --field translation --kind vocab

Exit code is non-zero if any file lost records or changed an unrelated field.
"""
import glob
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, lang_slug, load_collection_list

KINDS = {
    'questions': ('_questions', 'items'),
    'vocab': ('_vocab', 'entries'),
    'class': ('_class', 'items'),
}


def _records(blob, key):
    return blob.get(key, []) if isinstance(blob, dict) else (blob or [])


def _head(path):
    r = subprocess.run(['git', 'show', 'HEAD:' + path.replace(os.sep, '/')],
                       capture_output=True)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout.decode('utf-8'))
    except Exception:
        return None


def main(argv):
    root = parse_root(argv)
    field = 'instruction'
    kind = 'questions'
    if '--field' in argv:
        field = argv[argv.index('--field') + 1]
    if '--kind' in argv:
        kind = argv[argv.index('--kind') + 1]
    if kind not in KINDS:
        print('Unknown --kind %r. Use one of: %s' % (kind, ', '.join(KINDS)))
        return 2
    subdir, reckey = KINDS[kind]

    slugs = [c['slug'] for c in load_collection_list(root)]
    total = done = nonempty = 0
    problems = 0
    pending = []

    print('%-46s %7s %7s %9s  %s' % ('file', 'records', 'w/ field', 'non-empty', 'integrity'))
    print('-' * 92)
    for slug in slugs:
        # Chunk-backed books are authoritative in their chunks; a book with no
        # chunk directory is authoritative in its merged file (see Step 7b).
        chunks = sorted(glob.glob(os.path.join(root, slug, 'pages', subdir, 'chunk-*.json')))
        merged = os.path.join(root, slug, 'pages', '%s.json' % subdir)
        files = chunks if chunks else ([merged] if os.path.exists(merged) else [])

        for fp in files:
            with open(fp, encoding='utf-8') as f:
                recs = _records(json.load(f), reckey)
            if not recs:
                continue
            n = len(recs)
            total += n
            if field not in recs[0]:
                pending.append(fp)
                print('%-46s %7d %7d %9d  not started' % (fp[-46:], n, 0, 0))
                continue
            done += n
            nz = sum(1 for r in recs if (r.get(field) or '').strip())
            nonempty += nz

            old = _head(os.path.relpath(fp, os.path.dirname(os.path.dirname(root))))
            if old is None:
                old = _head(fp)
            note = 'not in HEAD (new file)'
            if old is not None:
                prev = _records(old, reckey)
                if len(prev) != n:
                    note = 'RECORD COUNT %d -> %d' % (len(prev), n)
                    problems += 1
                else:
                    drift = sum(1 for a, b in zip(prev, recs) for k in set(a) | set(b)
                                if k != field and a.get(k) != b.get(k))
                    problems += drift
                    note = 'clean' if drift == 0 else 'CHANGED %d field(s)' % drift
            print('%-46s %7d %7d %9d  %s' % (fp[-46:], n, n, nz, note))

    print('-' * 92)
    pct = (100.0 * done / total) if total else 0
    print('%s: %d/%d records carry `%s` (%.1f%%), %d non-empty'
          % (lang_slug(root), done, total, field, pct, nonempty))
    print('unintended field changes: %d' % problems)
    if pending:
        print('\nnot started (%d):' % len(pending))
        for p in pending[:15]:
            print('   ', p)
    if problems:
        print('\nRESULT: BACKFILL IS NOT SAFE - records lost or unrelated fields changed')
        return 1
    print('\nRESULT: backfill is faithful - only `%s` was added' % field)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
