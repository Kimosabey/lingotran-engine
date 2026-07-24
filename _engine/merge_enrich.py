#!/usr/bin/env python
"""Assemble enrichment chunk files into the single JSON files build_exports.py reads.

Shared across every language via --root. Agent-based enrichment writes
per-range chunks:
  <slug>/pages/_class/chunk-*.json       -> merged into <slug>/pages/_class.json
  <slug>/pages/_questions/chunk-*.json   -> merged into <slug>/pages/_questions.json
(vocabulary already reads _vocab/chunk-*.json directly — no merge needed.)

Idempotent / re-runnable. Usage:
    python _engine/merge_enrich.py --root french/extracted <slug> [<slug> ...]
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, atomic_open


def _load_chunks(root, slug, sub):
    # Sorted by MODIFICATION TIME, not filename: a corrective re-run writes a
    # new chunk file whose name may sort earlier alphabetically than the
    # original it's meant to fix (e.g. chunk-25-50.json fixing a mistake in
    # chunk-1-50.json) -- mtime order ensures "most recently written" really
    # does mean "processed last" downstream, regardless of filename.
    # Each item is tagged with its origin file (as `_chunk`) so callers can
    # tell "duplicated within one normal chunk" (expected -- e.g. item labels
    # like 'a'/'1' legitimately restart per exercise on a page) apart from
    # "the same key came from two DIFFERENT chunk files" (a real re-run
    # collision worth a warning).
    paths = sorted(glob.glob(os.path.join(root, slug, 'pages', sub, 'chunk-*.json')),
                    key=lambda p: os.path.getmtime(p))
    items = []
    for p in paths:
        try:
            for it in json.load(open(p, encoding='utf-8')).get('items', []):
                it['_chunk'] = os.path.basename(p)
                items.append(it)
        except Exception as e:
            print('  ! skip %s (%s)' % (os.path.basename(p), e))
    return items


def merge_class(root, slug):
    items = _load_chunks(root, slug, '_class')
    if not items:
        return 0
    # Last-write-wins: since items are in mtime order, a later chunk's entry
    # for a page overwrites an earlier one instead of the earlier one
    # silently "winning" just because it was seen first. `page` is a genuine
    # 1:1 key (agent_enrich.md: "exactly one item per page"), so any repeat
    # here -- even within a single chunk -- is worth surfacing.
    by_page = {}
    overwrites = 0
    for it in items:
        pg = int(it.get('page', 0))
        if pg in by_page:
            overwrites += 1
        by_page[pg] = it
    if overwrites:
        print('  ! %d page(s) present in multiple _class chunks - using the most recently written' % overwrites)
    out = [{k: v for k, v in by_page[pg].items() if k != '_chunk'} for pg in sorted(by_page)]
    with atomic_open(os.path.join(root, slug, 'pages', '_class.json'), 'w', encoding='utf-8') as f:
        json.dump({'collection': slug, 'items': out}, f, ensure_ascii=False, indent=1)
    return len(out)


def merge_questions(root, slug):
    items = _load_chunks(root, slug, '_questions')
    if not items:
        return 0
    # No natural 1:1 key for questions (unlike classification's one-per-page)
    # -- item labels like 'a'/'1' legitimately restart per exercise `part` on
    # the same page, so a repeated (source_page, part, item) key WITHIN one
    # chunk is normal, not a bug. Only flag a key if it came from two or more
    # DIFFERENT chunk files -- that specifically means a corrective re-run
    # added rows on top of an earlier pass instead of replacing them, and
    # that must be visible, not silent.
    key_chunks = {}
    for it in items:
        key = (str(it.get('source_page', '')), str(it.get('part', '')), str(it.get('item', '')))
        key_chunks.setdefault(key, set()).add(it['_chunk'])
    cross_chunk_repeats = sum(1 for chunks in key_chunks.values() if len(chunks) > 1)
    if cross_chunk_repeats:
        print('  ! %d (source_page, part, item) key(s) appear in more than one DIFFERENT _questions '
              'chunk file - a re-run may have added duplicate rows on top of an earlier pass; '
              'not deduped automatically, review before export' % cross_chunk_repeats)
    items = [{k: v for k, v in it.items() if k != '_chunk'} for it in items]
    items.sort(key=lambda x: (str(x.get('source_page', '')), str(x.get('item', ''))))
    with atomic_open(os.path.join(root, slug, 'pages', '_questions.json'), 'w', encoding='utf-8') as f:
        json.dump({'collection': slug, 'items': items}, f, ensure_ascii=False, indent=1)
    return len(items)


def main(argv):
    root = parse_root(argv)
    if not argv:
        print('Usage: python _engine/merge_enrich.py --root <lang>/extracted <slug> [<slug> ...]')
        return
    for slug in argv:
        c = merge_class(root, slug)
        q = merge_questions(root, slug)
        print('%-32s _class.json=%d items | _questions.json=%d items' % (slug, c, q))


if __name__ == '__main__':
    main(sys.argv[1:])
