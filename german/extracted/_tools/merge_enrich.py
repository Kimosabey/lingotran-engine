#!/usr/bin/env python
"""Assemble enrichment chunk files into the single JSON files the exporters read.

Agent-based enrichment (Workflow tool disabled) writes per-range chunks:
  <slug>/pages/_class/chunk-*.json       -> merged into <slug>/pages/_class.json
  <slug>/pages/_questions/chunk-*.json   -> merged into <slug>/pages/_questions.json
(vocabulary already reads _vocab/chunk-*.json directly — no merge needed.)

_class.json      {"collection", "items":[{page,activity_type,topic,summary}]}
_questions.json  {"collection", "items":[{section,teil,item,item_type,question,
                  option_a,option_b,option_c,correct_answer,topic,source_page}]}

Idempotent / re-runnable. Usage:
    python _tools/merge_enrich.py <slug> [<slug> ...]
"""
import glob
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)


def _load_chunks(slug, sub):
    paths = sorted(glob.glob(os.path.join(ROOT, slug, 'pages', sub, 'chunk-*.json')))
    items = []
    for p in paths:
        try:
            items.extend(json.load(open(p, encoding='utf-8')).get('items', []))
        except Exception as e:
            print('  ! skip %s (%s)' % (os.path.basename(p), e))
    return items


def merge_class(slug):
    items = _load_chunks(slug, '_class')
    if not items:
        return 0
    seen, out = set(), []
    for it in sorted(items, key=lambda x: int(x.get('page', 0))):
        pg = int(it.get('page', 0))
        if pg in seen:
            continue
        seen.add(pg)
        out.append(it)
    with open(os.path.join(ROOT, slug, 'pages', '_class.json'), 'w', encoding='utf-8') as f:
        json.dump({'collection': slug, 'items': out}, f, ensure_ascii=False, indent=1)
    return len(out)


def merge_questions(slug):
    items = _load_chunks(slug, '_questions')
    if not items:
        return 0
    items.sort(key=lambda x: (str(x.get('source_page', '')), str(x.get('item', ''))))
    with open(os.path.join(ROOT, slug, 'pages', '_questions.json'), 'w', encoding='utf-8') as f:
        json.dump({'collection': slug, 'items': items}, f, ensure_ascii=False, indent=1)
    return len(items)


def main(argv):
    if not argv:
        print('Usage: python _tools/merge_enrich.py <slug> [<slug> ...]')
        return
    for slug in argv:
        c = merge_class(slug)
        q = merge_questions(slug)
        print('%-32s _class.json=%d items | _questions.json=%d items' % (slug, c, q))


if __name__ == '__main__':
    main(sys.argv[1:])
