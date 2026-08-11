#!/usr/bin/env python
"""Build per-book deliverables + ONE merged CSV per data type — the shared-
engine replacement for German's catalog.py + questions.py + vocabulary.py +
merge_all.py (4 files, with a per-family tier), deliberately simplified per
the locked export-scope decision: no per-family tier, no two-stage merge.

For every NON-FROZEN collection in <root>/_tools/collections.json, writes:
  <collection>/<collection>.md            unified doc (overview + page index + body)
  <collection>/<collection>-catalog.csv   parked debug sheet (one row per page)
  <collection>/<collection>-questions.csv parked debug sheet (one row per item)
  <collection>/<collection>-vocabulary.csv parked debug sheet (one row per word)
Then ALWAYS recomputes, across every non-frozen collection with data on disk
(regardless of which single collection you might be actively working on),
exactly ONE merged sheet per type at the root:
  <lang>-catalog-all.csv | <lang>-questions-all.csv | <lang>-vocabulary-all.csv

"Parked" means: these per-collection CSVs are real, re-runnable, and useful
for a mid-book spot-check — but package_exports.py does not copy them into
the deliverable _exports/ tree. Only the 3 merged sheets + the unified .md
docs are the actual deliverable, per the user's explicit ask ("one unified
merged csv... enough, no need per-pdf exports as deliverables").

Section taxonomy is English (listening/reading/writing/speaking/grammar/
none) with a separate `chapter` field for coursebook chapter/unit identity —
two different concepts German's schema used to conflate into one `section`
column. Questions carry a per-item `level` (not just page-level) because a
`level_mode: inferred` collection can mix levels on one page.

All writes go through _common.atomic_open — a killed process leaves the
previous good file untouched, never a truncated one.

Usage:
    python _engine/build_exports.py --root french/extracted
    python _engine/build_exports.py --root french/extracted --types catalog,vocabulary
"""
import csv
import glob
import json
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (parse_root, lang_slug, load_collection_list, load_collections, atomic_open,
                     atomic_write_text, build_start_here,
                     # shared page/record helpers -- one definition, both pipelines
                     split_frontmatter, flat as _flat, word_count, page_title,
                     human_title, read_pages, load_classification, split_gender,
                     sparse_note)

KINDS = ['catalog', 'questions', 'vocabulary']
CATALOG_COLUMNS = ['collection', 'unit', 'section', 'chapter', 'content_type', 'activity_type',
                    'topic', 'level', 'status', 'qa', 'word_count', 'summary', 'title']
QUESTIONS_COLUMNS = ['collection', 'section', 'part', 'item', 'item_type', 'instruction',
                      'question', 'option_a', 'option_b', 'option_c', 'option_d',
                      'option_e', 'correct_answer', 'level', 'topic', 'source_page']
VOCAB_COLUMNS = ['collection', 'word', 'translation', 'article', 'gender', 'plural',
                 'word_class', 'example', 'topic', 'source_page']


def load_questions(root, slug):
    path = os.path.join(root, slug, 'pages', '_questions.json')
    if not os.path.exists(path):
        return None
    try:
        return json.load(open(path, encoding='utf-8')).get('items', [])
    except Exception:
        return []


def load_vocab_entries(root, slug):
    paths = sorted(glob.glob(os.path.join(root, slug, 'pages', '_vocab', 'chunk-*.json')))
    if not paths:
        return None
    seen, out = set(), []
    for p in paths:
        try:
            data = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        for e in data.get('entries', []):
            key = (e.get('word', '').strip().lower(), e.get('article', ''), e.get('source_page', ''))
            if not key[0] or key in seen:
                continue
            seen.add(key)
            out.append(e)
    out.sort(key=lambda e: (e.get('source_page', ''), e.get('word', '').lower()))
    return out


def _counts(rows, key, split=False):
    out = {}
    for r in rows:
        if split:
            for v in re.findall(r'[\w-]+', r[key]):
                out[v] = out.get(v, 0) + 1
        else:
            out[r[key] or '(none)'] = out.get(r[key] or '(none)', 0) + 1
    return out


def _table(title, counts):
    lines = ['**%s**\n' % title, '| %s | Count |' % title.split(' ', 1)[-1], '|---|---|']
    for k in sorted(counts, key=lambda x: (-counts[x], x)):
        lines.append('| %s | %d |' % (k, counts[k]))
    return lines


def _content_type(value, strip_brackets):
    v = (value or '').strip()
    if strip_brackets and v.startswith('[') and v.endswith(']'):
        return v[1:-1].strip()
    return v


def export_config(root):
    """Per-language export shape, declared in collections.json under "exports".

    Absent (French) means: global sheet named <lang>-<kind>-all.csv, no per-family
    sheets, no omitted columns -- exactly the behaviour before this existed.
    """
    return load_collections(root).get('exports') or {}


def columns_for_kind(kind, cfg):
    """The column list minus the ones this language declares it cannot fill.

    Declared, never inferred from which columns happen to be empty today. German
    ships option_d/option_e empty only because these ten books have no five-option
    items; a rule keyed on emptiness would silently reshape the schema the first
    time a book with one arrived, which is the exact class of invisible drift the
    gates exist to stop.
    """
    base = {'catalog': CATALOG_COLUMNS, 'questions': QUESTIONS_COLUMNS,
            'vocabulary': VOCAB_COLUMNS}[kind]
    omit = set((cfg.get('omit_columns') or {}).get(kind) or [])
    return [col for col in base if col not in omit]


def build_catalog(root, c, write=True):
    """Write the unified .md + parked debug catalog.csv; return its rows (or None).

    write=False gathers the rows without touching disk. Frozen collections need
    exactly that: their files must never be regenerated, but their rows still
    belong in the aggregate sheets. Skipping them wholesale -- as this did before
    -- produced a German global of 334 rows where the corpus holds 636, quietly
    dropping every frozen book from the deliverable.
    """
    slug = c['slug']
    cfg = export_config(root)
    # German's shipped catalogs carry content_type as "cover, toc"; French's carry
    # "[cover, toc]" -- the raw YAML list form. Declared per language rather than
    # unified, because either choice rewrites one language's delivered sheets and
    # P1 is a refactor, not a redesign of what recipients already have.
    strip_ct = bool(cfg.get('strip_content_type_brackets'))
    cmap = load_classification(root, slug)
    rows, unified = [], []
    for unit, fm, body in read_pages(root, slug):
        pg = int(unit[5:])
        cl = cmap.get(pg, {})
        row = {
            'collection': slug, 'unit': unit,
            'section': fm.get('section', '').strip('"') or '',
            'chapter': fm.get('chapter', '').strip('"') or '',
            'content_type': _content_type(fm.get('content_type', '') or '', strip_ct),
            'activity_type': cl.get('activity_type', ''), 'topic': cl.get('topic', ''),
            'level': fm.get('level', c.get('level', '')),
            'status': fm.get('status', ''), 'qa': fm.get('qa', ''),
            'word_count': word_count(body),
            'summary': cl.get('summary', ''), 'title': page_title(body),
        }
        rows.append(row)
        tags = ' - '.join(t for t in [row['section'], row['chapter'], row['content_type'],
                                       row['activity_type'], row['topic']] if t)
        hdr = '## %s' % unit.replace('page-', 'Page ')
        if tags:
            hdr += '  -- %s' % tags
        unified.append('%s\n\n%s' % (hdr, body if body else '_(empty)_'))

    if not rows:
        print('%-32s no pages yet, skipped' % slug)
        return None

    if not write:
        print('%-32s %3d pages (frozen - rows counted, files untouched)' % (slug, len(rows)))
        return rows

    cat_cols = columns_for_kind('catalog', export_config(root))
    with atomic_open(os.path.join(root, slug, '%s-catalog.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cat_cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)

    note = c.get('source_note', '')
    ov = ['# %s\n' % human_title(c),
          '> Unified transcription of `%s` - %d pages.%s' % (
              c.get('pdf', ''), len(rows), (' Source: %s.' % note) if note else ''),
          '> Generated %s. Filterable sheet: `%s-catalog.csv`.\n' % (datetime.now().strftime('%Y-%m-%d'), slug),
          '## Overview\n']
    # A column this language declares it cannot fill must not surface in the .md
    # either, or the deliverable carries a "By chapter" table reading "(none) 174"
    # -- the markdown equivalent of the dead column the omission exists to avoid.
    has_chapter = 'chapter' in cat_cols
    ov += _table('By skill section', _counts(rows, 'section')) + ['']
    if has_chapter:
        ov += _table('By chapter', _counts(rows, 'chapter')) + ['']
    ov += _table('By content type', _counts(rows, 'content_type', split=True)) + ['']
    ov += _table('By activity type', _counts(rows, 'activity_type')) + ['']
    ov += _table('By topic', _counts(rows, 'topic')) + ['']
    # What this BOOK does not print is a limitation of the source, not of the
    # extraction, and belongs where a reader already looks for both (gap P7).
    # Computed from the shipped rows, so it can never drift from the file.
    notes = list(c.get('caveats') or [])
    notes += ['Vocabulary sheet: ' + s
              for s in sparse_note(load_vocab_entries(root, slug) or [])]
    if notes:
        ov += ['## Known limitations\n']
        ov += ['- %s' % cav for cav in notes] + ['']
    if has_chapter:
        ov += ['## Page index\n', '| Page | Section | Chapter | Activity | Topic | Summary |',
               '|---|---|---|---|---|---|']
    else:
        ov += ['## Page index\n', '| Page | Section | Activity | Topic | Summary |',
               '|---|---|---|---|---|']
    for r in rows:
        cells = [r['unit'].replace('page-', ''), r['section'] or '']
        if has_chapter:
            cells.append(r['chapter'] or '')
        cells += [r['activity_type'] or '', r['topic'] or '',
                  (r['summary'] or r['title']).replace('|', '/')]
        ov.append('| %s |' % ' | '.join(cells))
    ov.append('\n---\n')
    atomic_write_text(os.path.join(root, slug, '%s.md' % slug), '\n'.join(ov) + '\n' + '\n\n'.join(unified) + '\n')

    classified = sum(1 for r in rows if r['activity_type'])
    print('%-32s %3d pages (%d classified) -> %s.md + %s-catalog.csv' % (slug, len(rows), classified, slug, slug))
    return rows


def build_questions(root, c, write=True):
    slug = c['slug']
    items = load_questions(root, slug)
    if items is None:
        return None
    rows = [{col: '' for col in QUESTIONS_COLUMNS} | {
        'collection': slug,
        'section': _flat(it.get('section', '')), 'part': _flat(it.get('part', it.get('teil', ''))),
        'item': _flat(it.get('item', '')), 'item_type': _flat(it.get('item_type', '')),
        'instruction': _flat(it.get('instruction', '')),
        'question': _flat(it.get('question', '')),
        'option_a': _flat(it.get('option_a', '')), 'option_b': _flat(it.get('option_b', '')),
        'option_c': _flat(it.get('option_c', '')),
        'option_d': _flat(it.get('option_d', '')),
        'option_e': _flat(it.get('option_e', '')),
        'correct_answer': _flat(it.get('correct_answer', '')),
        'level': _flat(it.get('level', c.get('level', ''))),
        'topic': _flat(it.get('topic', '')), 'source_page': _flat(it.get('source_page', '')),
    } for it in items]
    if not write:
        return rows
    with atomic_open(os.path.join(root, slug, '%s-questions.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=columns_for_kind('questions', export_config(root)),
                           extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)
    answered = sum(1 for r in rows if r['correct_answer'] and r['correct_answer'] != '(open-ended)')
    print('%-32s %3d items (%d with answers) -> %s-questions.csv' % (slug, len(rows), answered, slug))
    return rows


def build_vocabulary(root, c, write=True):
    slug = c['slug']
    entries = load_vocab_entries(root, slug)
    if entries is None:
        return None
    rows = [{
        'collection': slug,
        'word': _flat(e.get('word', '')),
        'translation': _flat(e.get('translation', '')),
        'article': _flat(e.get('article', '')),
        'gender': _flat(e.get('gender') or split_gender(e.get('word', ''))[1]),
        'plural': _flat(e.get('plural', '')), 'word_class': _flat(e.get('word_class', '')),
        'example': _flat(e.get('example', '')), 'topic': _flat(e.get('topic', '')),
        'source_page': _flat(e.get('source_page', '')),
    } for e in entries]
    if not write:
        return rows
    with atomic_open(os.path.join(root, slug, '%s-vocabulary.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=columns_for_kind('vocabulary', export_config(root)),
                           extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)
    nouns = sum(1 for r in rows if r['word_class'] == 'noun')
    withex = sum(1 for r in rows if r['example'])
    print('%-32s %4d words (%d nouns, %d with examples) -> %s-vocabulary.csv'
          % (slug, len(rows), nouns, withex, slug))
    return rows


def main(argv):
    root = parse_root(argv)
    types_wanted = KINDS[:]
    if '--types' in argv:
        i = argv.index('--types')
        types_wanted = argv[i + 1].split(',')
        del argv[i:i + 2]

    cols = load_collection_list(root)
    lang = lang_slug(root)
    cfg = export_config(root)
    merged = {k: [] for k in KINDS}
    by_family = {k: {} for k in KINDS}

    def collect(kind, rows, c):
        if not rows:
            return
        merged[kind].extend(rows)
        fam = c.get('family')
        if fam and cfg.get('family_basename'):
            by_family[kind].setdefault(fam, []).extend(rows)

    for c in cols:
        slug = c['slug']
        # Frozen means "never regenerate this book's files", NOT "pretend this
        # book has no data". Skipping it outright is why a German global held 334
        # rows against a 636-page corpus: every frozen book silently vanished
        # from the deliverable. Gather the rows, write nothing.
        frozen = bool(c.get('frozen'))
        # A book on another pipeline is registered for VISIBILITY (so
        # reconcile.py reports it instead of it reading as done by omission --
        # gap P9), not for delivery. Its data predates the current taxonomy and
        # is incomplete, so including it would put non-conforming rows into the
        # deliverable and fail the export gate.
        if c.get('pipeline') and c['pipeline'] != 'engine':
            print('%-32s pipeline: %s - not exported (registered for visibility only)'
                  % (slug, c['pipeline']))
            continue
        collect('catalog', build_catalog(root, c, write=not frozen), c)
        collect('questions', build_questions(root, c, write=not frozen), c)
        collect('vocabulary', build_vocabulary(root, c, write=not frozen), c)

    def write_sheet(path, kind, rows):
        with atomic_open(path, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=columns_for_kind(kind, cfg), extrasaction='ignore')
            w.writeheader()
            w.writerows(rows)

    global_base = cfg.get('global_basename') or lang
    family_base = cfg.get('family_basename')
    for kind in KINDS:
        if kind not in types_wanted:
            continue
        rows = merged[kind]
        if not rows:
            print('%-11s no rows found across all collections - skipped' % kind)
            continue
        # Per-family sheets, when the language declares them. Built from the same
        # in-memory rows as the global, so the two can never disagree -- unlike a
        # merge step that re-reads family CSVs off disk, where a family sheet
        # nobody regenerated silently becomes the source of truth.
        if family_base:
            for fam in sorted(by_family[kind]):
                fam_rows = by_family[kind][fam]
                fam_path = os.path.join(root, '%s-%s-all.csv' % (family_base.format(family=fam), kind))
                write_sheet(fam_path, kind, fam_rows)
                print('%-11s -> %s (%d rows)' % (kind, os.path.basename(fam_path), len(fam_rows)))
        # With a family tier, the global is the family sheets end to end in
        # alphabetical family order -- what the two-stage merge produced by
        # globbing them off disk. Config order would reorder 636 rows for no
        # reason and make the sheet's history unreadable in a diff.
        if family_base:
            rows = [r for fam in sorted(by_family[kind]) for r in by_family[kind][fam]]
        path = os.path.join(root, '%s-%s-all.csv' % (global_base, kind))
        write_sheet(path, kind, rows)
        # Row-count reconciliation: re-read what actually landed on disk and
        # compare against what we meant to write. Never trust "the writerows
        # call didn't raise" as proof nothing was silently dropped.
        with open(path, encoding='utf-8-sig', newline='') as f:
            written = sum(1 for _ in csv.reader(f)) - 1
        if written != len(rows):
            print('%-11s !! MISMATCH: meant to write %d rows, %s actually has %d'
                  % (kind, len(rows), os.path.basename(path), written))
        else:
            print('%-11s -> %s (%d rows)' % (kind, os.path.basename(path), len(rows)))


if __name__ == '__main__':
    main(sys.argv[1:])
