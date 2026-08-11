#!/usr/bin/env python
"""Build per-book deliverables from transcribed pages + classification.

  <collection>/<collection>.md            unified doc (overview + page index + body)
  <collection>/<collection>-catalog.csv   filterable page sheet (one row per page)
  <family>-a1-catalog-all.csv             per-publisher combined (goethe|netzwerk|goyal)

The GLOBAL german-a1-catalog-all.csv is built by merge_all.py, not here.

Source-agnostic: display title + provenance come from collections.json
(`title`, `source_note`), so nothing is hardcoded to a publisher. Any
collection marked `"frozen": true` is skipped entirely — already-delivered
outputs are never regenerated. CSVs are UTF-8 with BOM (Excel-safe).

Usage:
    python _tools/catalog.py --all                 # every non-frozen collection
    python _tools/catalog.py <slug> [<slug>…]      # specific collections
"""
import csv
import glob
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime

TOOLS = os.path.dirname(os.path.abspath(__file__))
# Atomic writes are shared with _engine rather than reimplemented: a killed
# process must never leave a truncated file where a completed one is expected.
sys.path.insert(0, os.path.abspath(os.path.join(TOOLS, '..', '..', '..', '_engine')))
from _common import (atomic_open,
                     # shared page/record helpers -- one definition, both pipelines
                     split_frontmatter, word_count, page_title, read_pages,
                     load_classification, human_title as _human_title)
ROOT = os.path.dirname(TOOLS)  # german/extracted/
CONFIG = os.path.join(TOOLS, 'collections.json')
COLUMNS = ['collection', 'unit', 'section', 'content_type', 'activity_type', 'topic',
           'level', 'status', 'qa', 'word_count', 'summary', 'title']


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


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


def build_collection(c):
    """Write the unified .md + per-collection catalog.csv; return its rows (or None)."""
    slug = c['slug']
    if c.get('frozen'):
        print('%-32s frozen — skipped' % slug)
        return None
    cmap = load_classification(ROOT, slug)
    rows, unified = [], []
    for unit, fm, body in read_pages(ROOT, slug):
        pg = int(unit[5:])
        cl = cmap.get(pg, {})
        row = {
            'collection': slug, 'unit': unit,
            'section': fm.get('section', '').strip('"') or '',
            'content_type': (fm.get('content_type', '') or '').strip('[]'),
            'activity_type': cl.get('activity_type', ''), 'topic': cl.get('topic', ''),
            'level': fm.get('level', c.get('level', '')),
            'status': fm.get('status', ''), 'qa': fm.get('qa', ''),
            'word_count': word_count(body),
            'summary': cl.get('summary', ''), 'title': page_title(body),
        }
        rows.append(row)
        tags = ' · '.join(t for t in [row['section'], row['content_type'], row['activity_type'], row['topic']] if t)
        hdr = '## %s' % unit.replace('page-', 'Page ')
        if tags:
            hdr += '  — %s' % tags
        unified.append('%s\n\n%s' % (hdr, body if body else '_(empty)_'))

    if not rows:
        print('%-32s no pages yet, skipped' % slug)
        return None

    with atomic_open(os.path.join(ROOT, slug, '%s-catalog.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    note = c.get('source_note', '')
    ov = ['# %s\n' % _human_title(c, ' · '),
          '> Unified transcription of `%s` — %d pages.%s' % (
              c.get('pdf', ''), len(rows), (' Source: %s.' % note) if note else ''),
          '> Generated %s. Filterable sheet: `%s-catalog.csv`.\n' % (datetime.now().strftime('%Y-%m-%d'), slug),
          '## Overview\n']
    ov += _table('By skill section', _counts(rows, 'section')) + ['']
    ov += _table('By content type', _counts(rows, 'content_type', split=True)) + ['']
    ov += _table('By activity type', _counts(rows, 'activity_type')) + ['']
    ov += _table('By topic', _counts(rows, 'topic')) + ['']
    ov += ['## Page index\n', '| Page | Section | Activity | Topic | Summary |', '|---|---|---|---|---|']
    for r in rows:
        ov.append('| %s | %s | %s | %s | %s |' % (
            r['unit'].replace('page-', ''), r['section'] or '', r['activity_type'] or '',
            r['topic'] or '', (r['summary'] or r['title']).replace('|', '/')))
    ov.append('\n---\n')
    with atomic_open(os.path.join(ROOT, slug, '%s.md' % slug), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(ov) + '\n' + '\n\n'.join(unified) + '\n')

    classified = sum(1 for r in rows if r['activity_type'])
    print('%-32s %3d pages (%d classified) -> %s.md + %s-catalog.csv' % (slug, len(rows), classified, slug, slug))
    return rows


def write_combined(path, rows):
    with atomic_open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)


def main(argv):
    cols = load_collections()
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug.')
        return
    by_family = defaultdict(list)
    for c in targets:
        rows = build_collection(c)
        if rows:
            by_family[c.get('family', 'german')].extend(rows)
    for fam, rows in by_family.items():
        path = os.path.join(ROOT, '%s-a1-catalog-all.csv' % fam)
        write_combined(path, rows)
        print('per-family sheet -> %s (%d rows)' % (os.path.basename(path), len(rows)))


if __name__ == '__main__':
    main(sys.argv[1:])
