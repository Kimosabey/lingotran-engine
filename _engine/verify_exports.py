#!/usr/bin/env python
"""Deliverable gate: is what we're about to hand over actually readable?

`reconcile.py` proves every page was transcribed and classified, and
`verify_answers.py` proves answers have a usable shape. Neither one ever looks
at the CSVs a recipient actually opens, so a whole class of defect shipped
undetected until it was found by hand on 2026-08-10:

  - HTML comments landing in the catalog's `title` column, so 16 French pages
    were titled "<!-- this page is blank (verified: solid white) -->";
  - German naming its exercise-group column `teil` where French named the same
    concept `part`, so the two languages' sheets did not line up;
  - `level` recorded as "A2 (inferred)" for all 2,750 rows of one book, which
    silently broke every level filter on the combined sheet;
  - header-only CSVs shipped for booklets that have no questions at all;
  - `&nbsp;` entities and ragged trailing whitespace inside cells.

Every one of those is invisible to the existing gates and obvious to a human
opening the file. This closes that gap so the next book cannot repeat them.

Language-agnostic, like every other engine tool -- pass `--root`, and it also
works against German's bespoke pipeline because it only reads the output.

Usage:
    python _engine/verify_exports.py --root french/extracted
    python _engine/verify_exports.py --root german/extracted
    python _engine/verify_exports.py --root french/extracted --quiet

Exit code is non-zero if anything fails: treat it as a hard stop before
packaging or delivery, exactly like reconcile.py.
"""
import csv
import glob
import io
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, lang_slug, load_collections, load_collection_list

# Column names are English in every language and identical across languages for
# the same sheet -- the header row is schema, not source material. `chapter` is
# the one legitimate per-language difference: German books carry no chapter
# frontmatter, and a permanently-empty column reads worse than an absent one.
CANON = {
    'questions': ['collection', 'section', 'part', 'item', 'item_type', 'instruction',
                  'question', 'option_a', 'option_b', 'option_c', 'option_d',
                  'option_e', 'correct_answer', 'level', 'topic', 'source_page'],
    'vocabulary': ['collection', 'word', 'translation', 'article', 'gender',
                   'plural', 'word_class', 'example', 'topic', 'source_page'],
    'catalog': ['collection', 'unit', 'section', 'chapter', 'content_type',
                'activity_type', 'topic', 'level', 'status', 'qa', 'word_count',
                'summary', 'title'],
}
# `chapter` is the one legitimate per-language difference: German books carry
# no chapter frontmatter, and a permanently-empty column reads worse than an
# absent one. `instruction` WAS optional while only French had rubrics; both
# languages are now backfilled (9,744 items), so it is required again.
# `translation` exists only where the book itself is bilingual and prints an
# English column (Tricolore's Francais-anglais glossaries). Cosmopolite and
# every German book are monolingual, so requiring it would force an empty
# column on them -- the same defect as the header-only CSVs.
OPTIONAL = {'catalog': {'chapter'}, 'vocabulary': {'translation', 'gender'}}

# Cells a human reads. Machine/enum columns are covered by the taxonomy rules
# in agent_enrich.md and by verify_answers.py.
TEXT_COLS = ('instruction', 'question', 'option_a', 'option_b', 'option_c',
             'option_d', 'option_e',
             'correct_answer', 'word', 'translation', 'example', 'summary',
             'title', 'part', 'chapter')

# --- taxonomy ------------------------------------------------------------
# Closed enums: a value outside the set is a defect, not a new category.
CLOSED_ENUMS = {
    'section': {'listening', 'reading', 'writing', 'speaking', 'grammar',
                'vocabulary', 'none', ''},
    'item_type': {'multiple-choice', 'matching', 'true-false', 'fill-in', 'ordering',
                  'short-answer', 'writing-task', 'speaking-task', 'open-ended', ''},
    'word_class': {'noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun',
                   'conjunction', 'phrase', 'number', 'other', ''},
    'status': {'transcribed', 'verified', ''},
    'qa': {'pass', 'fail', ''},
    'level': {'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'mixed', ''},
}

# Open vocabularies: genuinely book-specific, so new values are expected. They
# are still English-only, and drift is worth seeing rather than silently
# accumulating -- `defective-image` reached a shipped catalog this way.
OPEN_VOCAB = {
    'content_type': {'cover', 'toc', 'intro', 'instructions', 'reading-text', 'exercise',
                     'listening-sheet', 'writing-prompt', 'speaking-prompt', 'vocabulary',
                     'answer-key', 'lesson', 'grammar-box', 'dialogue', 'audio-script',
                     'wordlist', 'chapter-opener', 'review', 'picture-story', 'song',
                     # Adopted 2026-08-10 after a drift review: each names a real
                     # page element with no existing equivalent. Near-duplicates
                     # found in the same pass were collapsed instead (reading ->
                     # reading-text, listening/listening-task -> listening-sheet,
                     # grammar/grammar-table -> grammar-box, glossary -> wordlist,
                     # matching/logic-puzzle -> exercise, since those two are
                     # item_types rather than page content types).
                     'explanation', 'comprehension-questions', 'strategy-box',
                     'reference', 'phonetics', 'conjugation-table', 'table',
                     'illustration'},
    'activity_type': set(),
    'topic': set(),
}

# The taxonomy is English regardless of the book's language. Any letter outside
# Basic Latin in one of these columns means the source language leaked in --
# which is exactly how German shipped `section: hoeren`. Deliberately written
# as "no non-ASCII letters" rather than a per-language blocklist, so it works
# unchanged for Japanese, Russian, Arabic or anything else added later.
TAXONOMY_COLS = tuple(CLOSED_ENUMS) + tuple(OPEN_VOCAB)
NON_ASCII_LETTER = re.compile(r'[^\x00-\x7f]')
SLUGGY = re.compile(r'^[a-z0-9]+(-[a-z0-9]+){3,}$')  # e.g. "module-3-de-jour-en-jour"

CELL_CHECKS = [
    ('html or comment markup leaking into a cell', re.compile(r'<!--|-->|</?[a-zA-Z][^>]*>')),
    ('mojibake (UTF-8 read as latin-1)', re.compile(r'Ã[\x80-\xbf]|â€|Â[\xa0-\xbf]')),
    ('U+FFFD replacement character', re.compile('�')),
    ('unescaped HTML entity', re.compile(r'&(nbsp|amp|lt|gt|quot|#\d+);')),
    ('embedded newline or tab', re.compile(r'[\n\r\t]')),
    ('untrimmed leading/trailing whitespace', re.compile(r'^\s|\s$')),
    ('run of 2+ spaces', re.compile(r'  +')),
    ('markdown bold/heading/link markup', re.compile(r'\*\*.+?\*\*|^#{1,6}\s|\[[^\]]*\]\([^)]*\)')),
]


def kind_of(path):
    for k in CANON:
        if path.endswith('-%s.csv' % k) or path.endswith('-%s-all.csv' % k):
            return k
    return None


def read_csv(path):
    with io.open(path, encoding='utf-8-sig', newline='') as f:
        return list(csv.reader(f))


def check_header(path, header, kind, fail):
    canon = CANON[kind]
    optional = OPTIONAL.get(kind, set())
    extra = [c for c in header if c not in canon]
    if extra:
        fail(path, 'non-canonical column name(s): %s -- column names are English and '
                   'shared across languages' % ', '.join(extra))
    missing = [c for c in canon if c not in header and c not in optional]
    if missing:
        fail(path, 'missing column(s): %s' % ', '.join(missing))
    ordered = [c for c in canon if c in header]
    if [c for c in header if c in canon] != ordered:
        fail(path, 'columns out of canonical order: got %s' % ', '.join(header))


def check_rows(path, rows, fail):
    header = rows[0]
    ncol = len(header)
    if len(rows) == 1:
        fail(path, 'header-only file (no data rows) -- omit the file instead of '
                   'shipping an empty one')
        return
    ragged = [i for i, r in enumerate(rows[1:], start=2) if len(r) != ncol]
    if ragged:
        fail(path, '%d row(s) with the wrong column count, first at line %d'
             % (len(ragged), ragged[0]))
    idx = {c: i for i, c in enumerate(header)}
    hits = {}
    for lineno, row in enumerate(rows[1:], start=2):
        for col in TEXT_COLS:
            i = idx.get(col)
            if i is None or i >= len(row):
                continue
            v = row[i]
            if not v:
                continue
            if any(unicodedata.category(ch) == 'Cc' for ch in v):
                hits.setdefault(('control character', col), []).append(lineno)
            for label, rx in CELL_CHECKS:
                if rx.search(v):
                    hits.setdefault((label, col), []).append(lineno)
    for (label, col), lines in sorted(hits.items()):
        fail(path, '%s in `%s` (%d cell(s), first at line %d)'
             % (label, col, len(lines), lines[0]))


def _split_taxonomy(col, raw):
    """content_type ships as a bracketed list ("[exercise, grammar-box]");
    everything else is a single value."""
    v = raw.strip()
    if col == 'content_type':
        return [t.strip() for t in v.strip('[]').split(',') if t.strip()]
    return [v] if v else []


def check_taxonomy(path, rows, fail, drift):
    """Taxonomy columns are our own scheme, so they are English-only and, where
    the set is closed, drawn from a fixed enum. This is the check that would
    have caught both defects that actually shipped: German's `section: hoeren`
    and tricolore-2's `level: "A2 (inferred)"`.
    """
    header = rows[0]
    idx = {c: i for i, c in enumerate(header)}
    seen = {}
    for lineno, row in enumerate(rows[1:], start=2):
        for col in TAXONOMY_COLS:
            i = idx.get(col)
            if i is None or i >= len(row):
                continue
            for val in _split_taxonomy(col, row[i]):
                key = (col, val)
                if key in seen:
                    continue
                seen[key] = lineno
                if NON_ASCII_LETTER.search(val):
                    fail(path, 'non-English taxonomy value in `%s`: %r (line %d) -- '
                               'taxonomy is English in every language'
                         % (col, val, lineno))
                elif col in CLOSED_ENUMS and val not in CLOSED_ENUMS[col]:
                    fail(path, 'invalid `%s` value %r (line %d) -- not in the closed '
                               'enum %s' % (col, val, lineno,
                                            sorted(x for x in CLOSED_ENUMS[col] if x)))
                elif col in OPEN_VOCAB and OPEN_VOCAB[col] and val not in OPEN_VOCAB[col]:
                    if SLUGGY.match(val):
                        fail(path, 'slugified prose in `%s`: %r (line %d) -- looks like a '
                                   'chapter title, not a category' % (col, val, lineno))
                    else:
                        drift.setdefault((col, val), os.path.basename(path))


def check_coverage(root, fail, note):
    """Is each column as FULL as the corpus says it should be?

    Every other check here validates SHAPE -- names, types, hygiene. None asks
    whether a column that ought to be populated actually is. That gap shipped a
    German questions export at 8.7% `instruction` coverage which passed every
    other gate cleanly: the chunks had been backfilled but never re-merged, so
    the exporter read stale merged files. The 8.7% was exactly the books that
    had no chunk directory. It was caught by measuring, by hand, once.

    Expectations are DECLARED, not hardcoded, because "correct" is per book:
    Cosmopolite legitimately has 0% `translation` (monolingual), while Tricolore
    should be near 100% (its glossary prints English). Put them in
    collections.json:

        "expect_coverage": {"instruction": 90, "translation": 0}

    A column with no declared expectation is only reported, never failed --
    silence here must never be mistaken for approval.
    """
    try:
        cols = load_collections(root).get('collections', [])
    except Exception:
        # A root without a collections.json has nothing to declare against.
        # Report and move on rather than failing the whole gate on config.
        note('coverage: no collections.json - skipped')
        return
    expectations = {c['slug']: (c.get('expect_coverage') or {}) for c in cols}
    if not any(expectations.values()):
        note('coverage: no expect_coverage declared - reporting only')

    checked = 0
    for kind in ('questions', 'vocabulary', 'catalog'):
        for fp_ in sorted(glob.glob(os.path.join(root, '*', '*-%s.csv' % kind))):
            rows = read_csv(fp_)
            if len(rows) < 2:
                continue
            header, body = rows[0], rows[1:]
            idx = {c: i for i, c in enumerate(header)}
            slug = os.path.basename(os.path.dirname(fp_))
            want = expectations.get(slug) or {}
            for col, floor in want.items():
                # An expectation belongs to whichever sheet OWNS that column --
                # `instruction` is a questions field, `translation` a vocabulary
                # one. Checking every expectation against every sheet would flag
                # each as missing on the two sheets that never had it.
                if col not in CANON[kind]:
                    continue
                i = idx.get(col)
                if i is None:
                    fail(fp_, 'expect_coverage names `%s`, which belongs in the %s sheet, but '
                              'this file has no such column' % (col, kind))
                    continue
                filled = sum(1 for r in body if len(r) > i and r[i].strip())
                pct = 100.0 * filled / len(body)
                checked += 1
                if pct + 0.5 < floor:
                    fail(fp_, '`%s` is %.1f%% filled (%d/%d) but collections.json expects at '
                              'least %s%% - data may be stale; did merge_enrich run?'
                         % (col, pct, filled, len(body), floor))
    note('coverage: %d declared expectation(s) checked' % checked)


def check_page_refs(root, fail, note):
    """A question or vocabulary row citing a page the catalog does not contain
    is a dangling reference -- cheap to detect, invisible by eye."""
    dangling = 0
    for cat in sorted(glob.glob(os.path.join(root, '*', '*-catalog.csv'))):
        book = os.path.dirname(cat)
        rows = read_csv(cat)
        if not rows:
            continue
        idx = {c: i for i, c in enumerate(rows[0])}
        if 'unit' not in idx:
            continue
        pages = {r[idx['unit']].replace('page-', '').lstrip('0')
                 for r in rows[1:] if len(r) > idx['unit']}
        for kind in ('questions', 'vocabulary'):
            fp = os.path.join(book, os.path.basename(book) + '-%s.csv' % kind)
            if not os.path.exists(fp):
                continue
            sub = read_csv(fp)
            if not sub:
                continue
            si = {c: i for i, c in enumerate(sub[0])}
            if 'source_page' not in si:
                continue
            bad = set()
            for r in sub[1:]:
                if len(r) <= si['source_page']:
                    continue
                p = r[si['source_page']].strip().lstrip('0')
                if p and p not in pages:
                    bad.add(p)
            if bad:
                dangling += len(bad)
                fail(fp, 'source_page value(s) not present in this book\'s catalog: %s'
                     % ', '.join(sorted(bad)[:8]))
    note('page references: %d dangling' % dangling)


OPTION_COLS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e']


def check_item_shape(root, fail, note):
    """Per-item_type cell completeness on the merged questions sheet.

    Every other check here asks whether a cell is well-FORMED. This asks whether
    the cells an item_type needs are actually THERE, which is a different failure:
    a row can be perfectly clean and still be unusable, and nothing was measuring
    that. A `multiple-choice` item with no options is a choice question with
    nothing to choose from -- the reader sees `correct_answer: c` and has no way
    to learn what c was.

    Runs for every language off the merged sheet, so a new language is covered
    the moment it has one. The fill-rate table is printed on every run whether or
    not anything fails: rates are how you tell a real gap from a declared one --
    French sits near 49% on correct_answer because all three books are
    `separate-guide` and print no key, which is correct and would look alarming
    without the number next to it.

    Legitimate exceptions are declared per book in `accepted_option_gaps` as
    "page/item", the same discipline as accepted_qa_gaps and accepted_answer_flags:
    waived, but still printed every run.
    """
    # The GLOBAL sheet, not a family one. Globbing *-questions-all.csv also
    # matches German's per-family sheets, and picking the wrong one would report
    # a fill rate for a third of the corpus while looking authoritative.
    # Fixtures and part-built corpora may have no collections.json at all; this
    # check is an addition to the gate, not a new precondition for running it.
    try:
        cfg = load_collections(root).get('exports') or {}
        collections_list = load_collection_list(root)
    except (OSError, ValueError):
        return
    base = cfg.get('global_basename') or lang_slug(root)
    path = os.path.join(root, '%s-questions-all.csv' % base)
    if not os.path.exists(path):
        return
    with io.open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return

    accepted = {}
    for c in collections_list:
        for ref in (c.get('accepted_option_gaps') or []):
            accepted.setdefault(c['slug'], set()).add(str(ref))

    by_type = {}
    for r in rows:
        by_type.setdefault(r.get('item_type') or '(blank)', []).append(r)

    note('item shape: %d rows across %d item_type(s) in %s'
         % (len(rows), len(by_type), os.path.basename(path)))
    for t in sorted(by_type, key=lambda k: -len(by_type[k])):
        rs = by_type[t]
        filled = lambda col: 100.0 * sum(1 for r in rs if (r.get(col) or '').strip()) / len(rs)
        note('  %-16s n=%-5d question %3.0f%%  options %3.0f%%  correct_answer %3.0f%%'
             % (t, len(rs), filled('question'),
                100.0 * sum(1 for r in rs if any((r.get(c) or '').strip() for c in OPTION_COLS)) / len(rs),
                filled('correct_answer')))

    missing, waived = [], 0
    for r in by_type.get('multiple-choice', []):
        if any((r.get(c) or '').strip() for c in OPTION_COLS):
            continue
        ref = '%s/%s' % (r.get('source_page'), r.get('item'))
        if ref in accepted.get(r.get('collection'), set()):
            waived += 1
            continue
        missing.append('%s %s' % (r.get('collection'), ref))
    if waived:
        note('  ~ %d multiple-choice item(s) waived via accepted_option_gaps '
             '(options printed inline in the question)' % waived)
    if missing:
        fail(path, 'multiple-choice with no options at all (%d): %s%s -- either the '
                   'options were not captured, or the item_type is wrong; waive in '
                   'accepted_option_gaps if the options are printed inline in the question'
             % (len(missing), ', '.join(missing[:6]), ' ...' if len(missing) > 6 else ''))


def check_packaging(root, fail, note):
    """A packaged per-book file is a copy of its per-book source; any
    difference means the package is stale relative to the data."""
    exports = os.path.join(root, '_exports')
    if not os.path.isdir(exports):
        note('no _exports/ yet - packaging not run, skipped')
        return
    checked = drift = 0
    for fp in glob.glob(os.path.join(exports, '**', '*.*'), recursive=True):
        if not fp.endswith(('.csv', '.md')):
            continue
        rel = os.path.relpath(fp, exports).replace('\\', '/').split('/')
        if len(rel) < 2 or rel[0].startswith('_'):
            continue
        src = os.path.join(root, rel[-2], rel[-1])
        if not os.path.exists(src):
            continue
        checked += 1
        if io.open(src, 'rb').read() != io.open(fp, 'rb').read():
            drift += 1
            fail(fp, 'packaged copy differs from its source %s -- re-run '
                     'package_exports.py' % os.path.relpath(src, root))
    note('packaging: %d packaged file(s) compared, %d drifted' % (checked, drift))


def main(argv):
    root = parse_root(argv)
    quiet = '--quiet' in argv
    lang = lang_slug(root)
    failures = []

    def fail(path, msg):
        failures.append((os.path.relpath(path, root), msg))

    def note(msg):
        if not quiet:
            print('  %s' % msg)

    paths = sorted(set(glob.glob(os.path.join(root, '*', '*.csv')) +
                       glob.glob(os.path.join(root, '*.csv')) +
                       glob.glob(os.path.join(root, '_exports', '**', '*.csv'),
                                 recursive=True)))
    paths = [p for p in paths if kind_of(p)]
    if not paths:
        print('%s: no export CSVs found under %s - nothing to verify' % (lang, root))
        return 0

    print('%s: verifying %d export CSV(s)' % (lang, len(paths)))
    shapes = {}
    drift = {}
    for p in paths:
        kind = kind_of(p)
        try:
            rows = read_csv(p)
        except Exception as e:
            fail(p, 'unreadable as CSV: %s' % e)
            continue
        if not rows:
            fail(p, 'completely empty file')
            continue
        check_header(p, rows[0], kind, fail)
        check_rows(p, rows, fail)
        check_taxonomy(p, rows, fail, drift)
        shapes.setdefault(kind, {}).setdefault(tuple(rows[0]), []).append(os.path.basename(p))

    for kind, byshape in sorted(shapes.items()):
        if len(byshape) > 1:
            for shape, files in byshape.items():
                fail(os.path.join(root, files[0]),
                     'inconsistent %s header across this language: %s'
                     % (kind, ', '.join(shape)))
        else:
            note('%-11s header consistent across %d file(s)'
                 % (kind, sum(len(v) for v in byshape.values())))

    check_coverage(root, fail, note)
    check_page_refs(root, fail, note)
    check_item_shape(root, fail, note)
    check_packaging(root, fail, note)

    if drift and not quiet:
        print('\n  open-vocabulary drift (English and plausible, but outside the '
              'documented set - review, do not necessarily fix):')
        by_col = {}
        for (col, val), f in sorted(drift.items()):
            by_col.setdefault(col, []).append(val)
        for col, vals in sorted(by_col.items()):
            print('    %-14s %d new value(s): %s' % (col, len(vals), ', '.join(sorted(vals)[:14])))

    if failures:
        print('\n%d PROBLEM(S) - do not deliver:' % len(failures))
        for path, msg in failures:
            print('  %-52s %s' % (path, msg))
        return 1
    print('\nRESULT: exports are clean and deliverable')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
