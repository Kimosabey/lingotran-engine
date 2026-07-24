#!/usr/bin/env python
"""Assemble a clean, content-team-friendly deliverable tree under _exports/.

Shared across every language via --root. Non-destructive: COPIES the
already-generated unified per-collection docs + the 3 merged roll-up sheets
into a flat deliverable tree. Originals are never moved or modified.
Re-runnable — wipes and rebuilds _exports/ each time.

Deliberately flat (simplified vs. German's publisher-family nesting, per the
locked export-scope decision — no per-family tier needed at this scale):

  _exports/
    README.md
    START-HERE.md                        (only if a source file is provided)
    <lang>-catalog-all.csv
    <lang>-questions-all.csv
    <lang>-vocabulary-all.csv
    <collection>.md                      (one per non-frozen collection)

Per-collection CSVs are intentionally NOT copied here — they're parked debug
artifacts (see build_exports.py), not deliverables, per the locked scope.

START-HERE.md is an optional pass-through: if
<root>/_tools/START-HERE.source.md exists, it's copied in verbatim; a
curated human blurb belongs in a hand-edited file, not a Python string
literal. If it doesn't exist, no START-HERE.md is written.

Usage:
    python _engine/package_exports.py --root french/extracted
"""
import glob
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, lang_slug, load_collection_list, atomic_write_text

KINDS = ['catalog', 'questions', 'vocabulary']


def rows_in(path):
    if not os.path.exists(path):
        return 0
    with open(path, encoding='utf-8-sig', newline='') as f:
        return max(0, sum(1 for _ in f) - 1)


def main(argv):
    root = parse_root(argv)
    lang = lang_slug(root)
    final_out = os.path.join(root, '_exports')
    cols = load_collection_list(root)

    # Stage-then-swap: build the whole tree in a sibling temp dir first, then
    # os.replace() it over the real _exports/ in one atomic step. A crash or
    # kill anywhere during the build leaves the previous good _exports/
    # completely untouched, instead of a deleted-or-half-populated tree.
    out = final_out + '.tmp'
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)

    combined = []
    for kind in KINDS:
        src = os.path.join(root, '%s-%s-all.csv' % (lang, kind))
        if os.path.exists(src):
            dest = os.path.join(out, os.path.basename(src))
            shutil.copy2(src, dest)
            src_n, dest_n = rows_in(src), rows_in(dest)
            if src_n != dest_n:
                print('%-11s !! MISMATCH: source has %d rows, copy has %d' % (kind, src_n, dest_n))
            combined.append((os.path.basename(src), dest_n))

    manifest = []
    for c in cols:
        slug = c['slug']
        srcdir = os.path.join(root, slug)
        md = os.path.join(srcdir, '%s.md' % slug)
        has_md = os.path.exists(md)
        if has_md:
            shutil.copy2(md, os.path.join(out, '%s.md' % slug))
        counts = {kind: rows_in(os.path.join(srcdir, '%s-%s.csv' % (slug, kind))) for kind in KINDS}
        manifest.append((slug, c.get('title', slug), c.get('frozen', False), has_md, counts, c.get('caveats', [])))

    lines = [
        '# %s — Extraction Deliverables' % lang.title(), '',
        'Clean, content-team-ready exports. **All CSVs are UTF-8 with BOM** so accented',
        'characters render correctly on double-click in Excel / Google Sheets.', '',
        '## How this is organised', '',
        '- `%s-{catalog,questions,vocabulary}-all.csv` — one merged sheet per data type,' % lang,
        '  every book combined. This is the deliverable — filter the `collection` column',
        '  to isolate one book.',
        '- `<collection>.md` — the entire book as clean unified text, one file per book.', '',
        '## Sheet columns', '',
        '- **catalog** — one row per page: section, chapter, content type, activity, topic, level, status, word count, summary.',
        '- **questions** — one row per item: section, part, item, item_type, question, option_a/b/c, correct_answer, level, topic, source_page.',
        '- **vocabulary** — one row per word: word, article, plural, word_class, example, topic, source_page.',
        '', '## Combined sheets', '',
        '| Sheet | Rows |', '|---|---|',
    ]
    for name, n in combined:
        lines.append('| `%s` | %d |' % (name, n))
    lines += ['', '## Books', '', '| Book | Status | Pages | Questions | Words |', '|---|---|---|---|---|']
    for slug, title, frozen, has_md, counts, caveats in manifest:
        status = 'frozen (delivered earlier)' if frozen else ('included' if has_md else 'not yet processed')
        marker = ' *' if caveats else ''
        lines.append('| %s%s | %s | %s | %s | %s |' % (
            title, marker, status,
            counts['catalog'] or '—', counts['questions'] or '—', counts['vocabulary'] or '—'))
    any_caveats = [(title, cav) for _, title, _, _, _, cav in manifest if cav]
    if any_caveats:
        lines += ['', '_* see Known limitations below._']
        lines += ['', '## Known limitations', '']
        for title, cavs in any_caveats:
            for cav in cavs:
                lines.append('- **%s**: %s' % (title, cav))
    lines += ['', '_Generated by `_engine/package_exports.py` — re-run to refresh._', '']
    atomic_write_text(os.path.join(out, 'README.md'), '\n'.join(lines))

    src_start_here = os.path.join(root, '_tools', 'START-HERE.source.md')
    if os.path.exists(src_start_here):
        shutil.copy2(src_start_here, os.path.join(out, 'START-HERE.md'))

    # Swap the fully-built staging tree over the real _exports/ in one atomic
    # step. os.replace() on a directory works the same way it does for files
    # on both POSIX and Windows for a destination this process already owns.
    if os.path.isdir(final_out):
        shutil.rmtree(final_out + '.old', ignore_errors=True)
        os.replace(final_out, final_out + '.old')
    os.replace(out, final_out)
    shutil.rmtree(final_out + '.old', ignore_errors=True)
    out = final_out

    print('Built _exports/ :')
    print('  combined  : %d roll-up sheets' % len(combined))
    print('  books     : %d (%d with a unified .md)' % (len(manifest), sum(1 for m in manifest if m[3])))
    total_csv = len(glob.glob(os.path.join(out, '*.csv')))
    total_md = len(glob.glob(os.path.join(out, '*.md')))
    print('  total     : %d CSV + %d MD files' % (total_csv, total_md))


if __name__ == '__main__':
    main(sys.argv[1:])
