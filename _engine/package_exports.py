#!/usr/bin/env python
"""Assemble a clean, content-team-friendly deliverable tree under _exports/.

Shared across every language via --root. Non-destructive: COPIES the
already-generated per-collection docs + CSVs + the 3 merged roll-up sheets
into a clean deliverable tree. The source files (build_exports.py's outputs
under <root>/<slug>/ and <root>/<lang>-*-all.csv) are never moved or
modified — _exports/ is 100% derived, so it can always be rebuilt from
source. Re-runnable.

Clean layout — one home per file, README is the only loose file at the top
(no duplicates, no scattered loose CSVs, no floating .tmp/.old siblings):

  _exports/
    README.md                            column guide + book index
    START-HERE.md                        (only if a source file is provided)
    _combined/                           ALL books together (bulk use) -- ONLY
      <lang>-catalog-all.csv             when 2+ books have data (see below)
      <lang>-questions-all.csv
      <lang>-vocabulary-all.csv
    <collection>/                        one self-contained folder per book
      <collection>-catalog.csv
      <collection>-questions.csv
      <collection>-vocabulary.csv
      <collection>.md                    the whole book as one readable doc

A reviewer who wants one book opens that book's folder; who wants everything
opens _combined/. Each book's .md lives ONLY inside its own folder (never
also copied to the top level) and the combined CSVs live ONLY in _combined/
(never also loose at the top) — nothing is duplicated. Mirrors German's
per-book-folder + _combined/ convention; still simpler than German in one
way: no per-publisher-family tier (global + per-book only), per the locked
export-scope decision.

_combined/ is gated to 2+ books with data. With exactly one book it would be
a byte-for-byte duplicate of that book's own folder (same rows, same
everything) — a real "why do we need this file?" case hit live on Cosmopolite
A1 (the only book through export at the time). It reappears automatically
the moment a second book has data; nothing to configure.

Atomicity / no-loss guarantee: the rebuild happens IN PLACE with an
atomic per-file write (temp sibling file + os.replace — a FILE rename), and
stale files are pruned only AFTER every new file is in place. So _exports/
is never emptied and the previous delivery survives until each file is
atomically replaced by its new version; a crash mid-run leaves a working
tree (a mix of old + new at worst), never an empty or half-deleted one, and
the next run self-heals it. This deliberately avoids the whole-directory
os.replace swap an earlier version used: on Windows + VS Code the editor's
file-system watcher grabs a handle to any freshly-created directory, which
blocks a directory rename (WinError 5) but never blocks per-file writes.

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
from _common import (parse_root, lang_slug, load_collection_list, atomic_write_text,
                     build_start_here)

KINDS = ['catalog', 'questions', 'vocabulary']
COMBINED_DIR = '_combined'


def rows_in(path):
    if not os.path.exists(path):
        return 0
    with open(path, encoding='utf-8-sig', newline='') as f:
        return max(0, sum(1 for _ in f) - 1)


def _collection_has_data(root, slug):
    """True if this book has anything to ship (a unified .md or any CSV)."""
    d = os.path.join(root, slug)
    if os.path.exists(os.path.join(d, '%s.md' % slug)):
        return True
    return any(os.path.exists(os.path.join(d, '%s-%s.csv' % (slug, k))) for k in KINDS)


def _atomic_copy(src, dest):
    """Copy one file into place atomically: write to a temp sibling then
    os.replace it. A FILE rename succeeds even when a held directory handle
    (VS Code's watcher) would block a whole-directory rename."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    shutil.copy2(src, tmp)
    os.replace(tmp, dest)


def _prune(final, keep_files):
    """Remove anything under final/ not in the freshly-written keep set, then
    drop any directory left empty. Runs LAST, after every new file is in
    place, so a crash before this point never empties the tree. keep_files is
    a set of absolute file paths."""
    for dirpath, dirnames, filenames in os.walk(final, topdown=False):
        for fn in filenames:
            p = os.path.join(dirpath, fn)
            if os.path.abspath(p) not in keep_files:
                os.remove(p)
        if os.path.abspath(dirpath) != os.path.abspath(final) and not os.listdir(dirpath):
            os.rmdir(dirpath)


def main(argv):
    root = parse_root(argv)
    lang = lang_slug(root)
    final_out = os.path.join(root, '_exports')
    cols = load_collection_list(root)

    os.makedirs(final_out, exist_ok=True)
    keep = set()  # absolute paths of every file this run wrote — the survivors

    # The _combined/ roll-ups only earn their place with 2+ books: with a
    # single book they'd be a byte-for-byte duplicate of that one book's
    # folder (same rows, same everything), which violates the "one home per
    # file" rule. So emit _combined/ only when it genuinely combines more
    # than one book; below that, the single per-book folder IS the whole
    # deliverable. It reappears automatically once a second book lands.
    books_with_data = sum(1 for c in cols if _collection_has_data(root, c['slug']))
    combined = []
    if books_with_data >= 2:
        for kind in KINDS:
            src = os.path.join(root, '%s-%s-all.csv' % (lang, kind))
            if os.path.exists(src):
                name = os.path.basename(src)
                dest = os.path.join(final_out, COMBINED_DIR, name)
                _atomic_copy(src, dest)
                keep.add(os.path.abspath(dest))
                src_n, dest_n = rows_in(src), rows_in(dest)
                if src_n != dest_n:
                    print('%-24s !! MISMATCH: source has %d rows, copy has %d' % (name, src_n, dest_n))
                combined.append((name, dest_n))

    # One self-contained folder per book: its 3 CSVs + its .md, nothing
    # duplicated anywhere else in the tree.
    manifest = []
    for c in cols:
        slug = c['slug']
        srcdir = os.path.join(root, slug)
        md = os.path.join(srcdir, '%s.md' % slug)
        has_md = os.path.exists(md)

        counts = {}
        for kind in KINDS:
            src = os.path.join(srcdir, '%s-%s.csv' % (slug, kind))
            counts[kind] = rows_in(src)
            if os.path.exists(src):
                dest = os.path.join(final_out, slug, os.path.basename(src))
                _atomic_copy(src, dest)
                keep.add(os.path.abspath(dest))
                if rows_in(src) != rows_in(dest):
                    print('%-24s !! MISMATCH: source %d rows, copy %d'
                          % ('%s/%s' % (slug, os.path.basename(src)), rows_in(src), rows_in(dest)))
        if has_md:
            dest = os.path.join(final_out, slug, '%s.md' % slug)
            _atomic_copy(md, dest)
            keep.add(os.path.abspath(dest))

        manifest.append((slug, c.get('title', slug), c.get('frozen', False), has_md, counts, c.get('caveats', [])))

    lines = [
        '# %s — Extraction Deliverables' % lang.title(), '',
        'Clean, content-team-ready exports. **All CSVs are UTF-8 with BOM** so accented',
        'characters render correctly on double-click in Excel / Google Sheets.', '',
        '## How this is organised', '',
    ]
    if combined:
        lines += [
            '- `_combined/` — one merged sheet per data type, every book combined. Start here',
            '  for bulk use; filter the `collection` column to isolate one book.',
            '- `<collection>/` — one folder per book, holding that book\'s own catalog/questions/',
            '  vocabulary CSVs **and** the whole book as a single readable `.md`. Open one folder',
            '  to get just that book, no filtering needed.', '',
            'Every file lives in exactly one place — nothing is duplicated between `_combined/`',
            'and the per-book folders.', '',
        ]
    else:
        lines += [
            '- `<collection>/` — one folder per book, holding that book\'s own catalog/questions/',
            '  vocabulary CSVs **and** the whole book as a single readable `.md`.', '',
            '_(A `_combined/` folder with cross-book roll-up sheets appears here automatically',
            'once a second book is added — with a single book it would just duplicate the one',
            'folder below, so it is omitted.)_', '',
        ]
    lines += [
        '## Sheet columns', '',
        '- **catalog** — one row per page: section, chapter, content type, activity, topic, level, status, word count, summary.',
        '- **questions** — one row per item: section, part, item, item_type, question, option_a/b/c, correct_answer, level, topic, source_page.',
        '- **vocabulary** — one row per word: word, article, plural, word_class, example, topic, source_page.',
    ]
    if combined:
        lines += ['', '## Combined sheets (`_combined/`)', '', '| Sheet | Rows |', '|---|---|']
        for name, n in combined:
            lines.append('| `%s` | %d |' % (name, n))
    lines += ['', '## Books', '', '| Book | Folder | Status | Pages | Questions | Words |', '|---|---|---|---|---|---|']
    for slug, title, frozen, has_md, counts, caveats in manifest:
        status = 'frozen (delivered earlier)' if frozen else ('included' if has_md else 'not yet processed')
        marker = ' *' if caveats else ''
        folder = '`%s/`' % slug if (has_md or any(counts.values())) else '—'
        lines.append('| %s%s | %s | %s | %s | %s | %s |' % (
            title, marker, folder, status,
            counts['catalog'] or '—', counts['questions'] or '—', counts['vocabulary'] or '—'))
    any_caveats = [(title, cav) for _, title, _, _, _, cav in manifest if cav]
    if any_caveats:
        lines += ['', '_* see Known limitations below._']
        lines += ['', '## Known limitations', '']
        for title, cavs in any_caveats:
            for cav in cavs:
                lines.append('- **%s**: %s' % (title, cav))
    lines += ['', '_Generated by `_engine/package_exports.py` — re-run to refresh._', '']
    readme = os.path.join(final_out, 'README.md')
    atomic_write_text(readme, '\n'.join(lines))
    keep.add(os.path.abspath(readme))

    # START-HERE.md -- the content team's orientation page. Generated for EVERY
    # language from the same shared builder and the same real numbers, so all
    # languages' deliverables have the same shape and the page cannot drift
    # from what actually shipped. A hand-written _tools/START-HERE.source.md
    # still wins if one exists, for a language that needs bespoke wording.
    start_here = os.path.join(final_out, 'START-HERE.md')
    src_start_here = os.path.join(root, '_tools', 'START-HERE.source.md')
    if os.path.exists(src_start_here):
        _atomic_copy(src_start_here, start_here)
    else:
        atomic_write_text(start_here, build_start_here(
            lang,
            [{'title': title, 'folder': slug, 'pages': counts['catalog'],
              'questions': counts['questions'], 'words': counts['vocabulary'],
              'caveats': caveats, 'frozen': frozen}
             for slug, title, frozen, has_md, counts, caveats in manifest],
            combined=combined,
            generator='_engine/package_exports.py'))
    keep.add(os.path.abspath(start_here))

    # Prune stale files LAST — only now that every new file is safely in place.
    _prune(final_out, keep)

    print('Built _exports/ :')
    print('  combined  : %d roll-up sheets in %s/' % (len(combined), COMBINED_DIR))
    print('  books     : %d (%d with a unified .md)' % (len(manifest), sum(1 for m in manifest if m[3])))
    total_csv = len(glob.glob(os.path.join(final_out, '*', '*.csv')))       # _combined/ + each book folder
    total_md = len(glob.glob(os.path.join(final_out, '*.md'))) + len(glob.glob(os.path.join(final_out, '*', '*.md')))
    print('  total     : %d CSV + %d MD files' % (total_csv, total_md))


if __name__ == '__main__':
    main(sys.argv[1:])
