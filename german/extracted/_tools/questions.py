#!/usr/bin/env python
"""Emit per-question sheets from the extracted question records.

Reads each collection's pages/_questions.json (produced by
questions.workflow.js) and writes:

  <collection>/<collection>-questions.csv   one row per exam item:
      collection, section, part, item, item_type, instruction, question,
      option_a, option_b, option_c, correct_answer, level, topic, source_page
  <family>-a1-questions-all.csv   per-publisher combined (goethe|netzwerk|goyal)
  (the global german-a1-questions-all.csv is built by merge_all.py)

Opens in Excel / Google Sheets with native filters. Pure Python, re-runnable.

Usage:
    python _tools/questions.py --all
    python _tools/questions.py <slug> [<slug>…]
"""
import csv
import json
import os
import sys
from collections import defaultdict

TOOLS = os.path.dirname(os.path.abspath(__file__))
# Atomic writes are shared with _engine rather than reimplemented: a killed
# process must never leave a truncated file where a completed one is expected.
sys.path.insert(0, os.path.abspath(os.path.join(TOOLS, '..', '..', '..', '_engine')))
from _common import atomic_open, flat as _flat
ROOT = os.path.dirname(TOOLS)  # german/extracted/
CONFIG = os.path.join(TOOLS, 'collections.json')
# Column NAMES are English in every language's exports, the same rule the
# taxonomy VALUES follow (see the repo README, "Cross-language export
# conventions"). `part` was `teil` here until 2026-08-10, which left the German
# and French questions sheets misaligned on the same concept. The cell values
# stay verbatim as printed -- German exam papers really do print "Teil 1" and
# "Übung 2", and those are quotes from the book, not taxonomy.
# `level` is carried too, so both languages' questions sheets have the same
# shape; German records it per collection rather than per item (every German
# collection is a single fixed CEFR level).
COLUMNS = ['collection', 'section', 'part', 'item', 'item_type', 'instruction',
           'question', 'option_a', 'option_b', 'option_c', 'correct_answer',
           'level', 'topic', 'source_page']


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


def load_questions(slug):
    path = os.path.join(ROOT, slug, 'pages', '_questions.json')
    if not os.path.exists(path):
        return None
    try:
        return json.load(open(path, encoding='utf-8')).get('items', [])
    except Exception:
        return []


def row_for(slug, it, level=''):
    return {c: '' for c in COLUMNS} | {
        'collection': slug,
        # Source records still carry the old `teil` key; read either so the
        # rename is a pure export-schema change and no page data has to move.
        'section': _flat(it.get('section', '')),
        'part': _flat(it.get('part', it.get('teil', ''))),
        'item': _flat(it.get('item', '')), 'item_type': _flat(it.get('item_type', '')),
        'instruction': _flat(it.get('instruction', '')),
        'question': _flat(it.get('question', '')),
        'option_a': _flat(it.get('option_a', '')), 'option_b': _flat(it.get('option_b', '')),
        'option_c': _flat(it.get('option_c', '')),
        'correct_answer': _flat(it.get('correct_answer', '')),
        'level': _flat(it.get('level', level)),
        'topic': _flat(it.get('topic', '')), 'source_page': _flat(it.get('source_page', '')),
    }


def main(argv):
    cols = load_collections()
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug.')
        return

    by_family = defaultdict(list)
    for c in targets:
        slug = c['slug']
        if c.get('frozen'):
            print('%-32s frozen — skipped' % slug)
            continue
        items = load_questions(slug)
        if items is None:
            print('%-32s no _questions.json, skipped' % slug)
            continue
        rows = [row_for(slug, it, c.get('level', '')) for it in items]
        out_path = os.path.join(ROOT, slug, '%s-questions.csv' % slug)
        if not rows:
            # A pure word-list booklet has no exercises at all. Emitting a
            # header-only CSV puts an empty file in the deliverable that reads
            # as "questions are missing" rather than "this book has none" --
            # and it is already inconsistent with the exam-training booklets,
            # which simply have no vocabulary CSV. Skip it, and clear any
            # header-only file left behind by an earlier run.
            if os.path.exists(out_path):
                os.remove(out_path)
            print('%-32s   0 items - no questions CSV emitted (word-list booklet)' % slug)
            continue
        with atomic_open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(rows)
        by_family[c.get('family', 'german')].extend(rows)
        answered = sum(1 for r in rows if r['correct_answer'] and r['correct_answer'] != '(open-ended)')
        print('%-32s %3d items (%d with answers) -> %s-questions.csv' % (slug, len(rows), answered, slug))

    for fam, rows in by_family.items():
        path = os.path.join(ROOT, '%s-a1-questions-all.csv' % fam)
        with atomic_open(path, 'w', encoding='utf-8-sig', newline='') as cf:
            cw = csv.DictWriter(cf, fieldnames=COLUMNS)
            cw.writeheader()
            cw.writerows(rows)
        print('per-family sheet -> %s (%d items)' % (os.path.basename(path), len(rows)))


if __name__ == '__main__':
    main(sys.argv[1:])
