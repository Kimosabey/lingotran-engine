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
from _common import parse_root, lang_slug, load_collection_list, atomic_open, atomic_write_text

KINDS = ['catalog', 'questions', 'vocabulary']
CATALOG_COLUMNS = ['collection', 'unit', 'section', 'chapter', 'content_type', 'activity_type',
                    'topic', 'level', 'status', 'qa', 'word_count', 'summary', 'title']
QUESTIONS_COLUMNS = ['collection', 'section', 'part', 'item', 'item_type', 'question',
                      'option_a', 'option_b', 'option_c', 'correct_answer', 'level', 'topic', 'source_page']
VOCAB_COLUMNS = ['collection', 'word', 'article', 'plural', 'word_class', 'example', 'topic', 'source_page']


def _flat(v):
    """Collapse newlines/tabs so every value stays a single clean spreadsheet cell."""
    if v is None:
        return ''
    return ' '.join(str(v).split())


def split_frontmatter(txt):
    fm, body = {}, txt
    m = re.match(r'^---\n(.*?)\n---\n?', txt, re.S)
    if m:
        for ln in m.group(1).splitlines():
            if ':' in ln:
                k, v = ln.split(':', 1)
                fm[k.strip()] = v.strip()
        body = txt[m.end():]
    return fm, body


def page_title(body):
    for ln in body.splitlines():
        s = re.sub(r'^#+\s*', '', ln.strip())
        s = re.sub(r'[*_`>|\[\]]', '', s).strip()
        if s:
            return s[:90]
    return ''


def human_title(c):
    if c.get('title'):
        return c['title']
    variant = (c.get('variant') or '').replace('-', ' ').title()
    doc = os.path.splitext(os.path.basename(c.get('pdf', c['slug'])))[0].replace('-', ' ').title()
    return '%s - %s - %s' % (c.get('level', ''), variant, doc)


def read_pages(root, slug):
    for md in sorted(glob.glob(os.path.join(root, slug, 'pages', 'page-*.md'))):
        unit = 'page-' + os.path.basename(md)[5:8]
        fm, body = split_frontmatter(open(md, encoding='utf-8').read())
        yield unit, fm, body.strip()


def load_classification(root, slug):
    path = os.path.join(root, slug, 'pages', '_class.json')
    cmap = {}
    if os.path.exists(path):
        try:
            for it in json.load(open(path, encoding='utf-8')).get('items', []):
                cmap[int(it['page'])] = it
        except Exception:
            pass
    return cmap


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


def build_catalog(root, c):
    """Write the unified .md + parked debug catalog.csv; return its rows (or None)."""
    slug = c['slug']
    cmap = load_classification(root, slug)
    rows, unified = [], []
    for unit, fm, body in read_pages(root, slug):
        pg = int(unit[5:])
        cl = cmap.get(pg, {})
        row = {
            'collection': slug, 'unit': unit,
            'section': fm.get('section', '').strip('"') or '',
            'chapter': fm.get('chapter', '').strip('"') or '',
            'content_type': fm.get('content_type', '') or '',
            'activity_type': cl.get('activity_type', ''), 'topic': cl.get('topic', ''),
            'level': fm.get('level', c.get('level', '')),
            'status': fm.get('status', ''), 'qa': fm.get('qa', ''),
            'word_count': len(re.findall(r'\S+', body)),
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

    with atomic_open(os.path.join(root, slug, '%s-catalog.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=CATALOG_COLUMNS)
        w.writeheader()
        w.writerows(rows)

    note = c.get('source_note', '')
    ov = ['# %s\n' % human_title(c),
          '> Unified transcription of `%s` - %d pages.%s' % (
              c.get('pdf', ''), len(rows), (' Source: %s.' % note) if note else ''),
          '> Generated %s. Filterable sheet: `%s-catalog.csv`.\n' % (datetime.now().strftime('%Y-%m-%d'), slug),
          '## Overview\n']
    ov += _table('By skill section', _counts(rows, 'section')) + ['']
    ov += _table('By chapter', _counts(rows, 'chapter')) + ['']
    ov += _table('By content type', _counts(rows, 'content_type', split=True)) + ['']
    ov += _table('By activity type', _counts(rows, 'activity_type')) + ['']
    ov += _table('By topic', _counts(rows, 'topic')) + ['']
    if c.get('caveats'):
        ov += ['## Known limitations\n']
        ov += ['- %s' % cav for cav in c['caveats']] + ['']
    ov += ['## Page index\n', '| Page | Section | Chapter | Activity | Topic | Summary |', '|---|---|---|---|---|---|']
    for r in rows:
        ov.append('| %s | %s | %s | %s | %s | %s |' % (
            r['unit'].replace('page-', ''), r['section'] or '', r['chapter'] or '', r['activity_type'] or '',
            r['topic'] or '', (r['summary'] or r['title']).replace('|', '/')))
    ov.append('\n---\n')
    atomic_write_text(os.path.join(root, slug, '%s.md' % slug), '\n'.join(ov) + '\n' + '\n\n'.join(unified) + '\n')

    classified = sum(1 for r in rows if r['activity_type'])
    print('%-32s %3d pages (%d classified) -> %s.md + %s-catalog.csv' % (slug, len(rows), classified, slug, slug))
    return rows


def build_questions(root, c):
    slug = c['slug']
    items = load_questions(root, slug)
    if items is None:
        return None
    rows = [{col: '' for col in QUESTIONS_COLUMNS} | {
        'collection': slug,
        'section': _flat(it.get('section', '')), 'part': _flat(it.get('part', it.get('teil', ''))),
        'item': _flat(it.get('item', '')), 'item_type': _flat(it.get('item_type', '')),
        'question': _flat(it.get('question', '')),
        'option_a': _flat(it.get('option_a', '')), 'option_b': _flat(it.get('option_b', '')),
        'option_c': _flat(it.get('option_c', '')),
        'correct_answer': _flat(it.get('correct_answer', '')),
        'level': _flat(it.get('level', c.get('level', ''))),
        'topic': _flat(it.get('topic', '')), 'source_page': _flat(it.get('source_page', '')),
    } for it in items]
    with atomic_open(os.path.join(root, slug, '%s-questions.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=QUESTIONS_COLUMNS)
        w.writeheader()
        w.writerows(rows)
    answered = sum(1 for r in rows if r['correct_answer'] and r['correct_answer'] != '(open-ended)')
    print('%-32s %3d items (%d with answers) -> %s-questions.csv' % (slug, len(rows), answered, slug))
    return rows


def build_vocabulary(root, c):
    slug = c['slug']
    entries = load_vocab_entries(root, slug)
    if entries is None:
        return None
    rows = [{
        'collection': slug,
        'word': _flat(e.get('word', '')), 'article': _flat(e.get('article', '')),
        'plural': _flat(e.get('plural', '')), 'word_class': _flat(e.get('word_class', '')),
        'example': _flat(e.get('example', '')), 'topic': _flat(e.get('topic', '')),
        'source_page': _flat(e.get('source_page', '')),
    } for e in entries]
    with atomic_open(os.path.join(root, slug, '%s-vocabulary.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=VOCAB_COLUMNS)
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
    merged = {k: [] for k in KINDS}
    for c in cols:
        slug = c['slug']
        if c.get('frozen'):
            print('%-32s frozen - skipped' % slug)
            continue
        cat_rows = build_catalog(root, c)
        if cat_rows:
            merged['catalog'].extend(cat_rows)
        q_rows = build_questions(root, c)
        if q_rows:
            merged['questions'].extend(q_rows)
        v_rows = build_vocabulary(root, c)
        if v_rows:
            merged['vocabulary'].extend(v_rows)

    columns_for = {'catalog': CATALOG_COLUMNS, 'questions': QUESTIONS_COLUMNS, 'vocabulary': VOCAB_COLUMNS}
    for kind in KINDS:
        if kind not in types_wanted:
            continue
        rows = merged[kind]
        if not rows:
            print('%-11s no rows found across all collections - skipped' % kind)
            continue
        path = os.path.join(root, '%s-%s-all.csv' % (lang, kind))
        with atomic_open(path, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=columns_for[kind])
            w.writeheader()
            w.writerows(rows)
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
