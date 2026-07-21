#!/usr/bin/env python
"""Emit per-question sheets from the extracted question records.

Reads each collection's pages/_questions.json (produced by
questions.workflow.js) and writes:

  <collection>/<collection>-questions.csv   one row per exam item:
      collection, section, teil, item, item_type, question,
      option_a, option_b, option_c, correct_answer, topic, source_page
  german/extracted/goethe-a1-questions-all.csv   combined across all collections

Opens in Excel / Google Sheets with native filters. Pure Python, re-runnable.

Usage:
    python _tools/questions.py --all
    python _tools/questions.py <slug> [<slug>…]
"""
import csv
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)  # german/extracted/
CONFIG = os.path.join(TOOLS, 'collections.json')
COLUMNS = ['collection', 'section', 'teil', 'item', 'item_type', 'question',
           'option_a', 'option_b', 'option_c', 'correct_answer', 'topic', 'source_page']


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


def row_for(slug, it):
    return {c: '' for c in COLUMNS} | {
        'collection': slug,
        'section': it.get('section', ''), 'teil': it.get('teil', ''),
        'item': it.get('item', ''), 'item_type': it.get('item_type', ''),
        'question': it.get('question', ''),
        'option_a': it.get('option_a', ''), 'option_b': it.get('option_b', ''),
        'option_c': it.get('option_c', ''),
        'correct_answer': it.get('correct_answer', ''),
        'topic': it.get('topic', ''), 'source_page': it.get('source_page', ''),
    }


def main(argv):
    cols = load_collections()
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug.')
        return

    combined = os.path.join(ROOT, 'goethe-a1-questions-all.csv')
    grand = 0
    with open(combined, 'w', encoding='utf-8-sig', newline='') as cf:
        cw = csv.DictWriter(cf, fieldnames=COLUMNS)
        cw.writeheader()
        for c in targets:
            slug = c['slug']
            items = load_questions(slug)
            if items is None:
                print('%-32s no _questions.json, skipped' % slug)
                continue
            rows = [row_for(slug, it) for it in items]
            with open(os.path.join(ROOT, slug, '%s-questions.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
                w = csv.DictWriter(f, fieldnames=COLUMNS)
                w.writeheader()
                w.writerows(rows)
            cw.writerows(rows)
            answered = sum(1 for r in rows if r['correct_answer'] and r['correct_answer'] != '(open-ended)')
            grand += len(rows)
            print('%-32s %3d items (%d with answers) -> %s-questions.csv' % (slug, len(rows), answered, slug))
    print('Combined -> %s  (%d items total)' % (combined, grand))


if __name__ == '__main__':
    main(sys.argv[1:])
