#!/usr/bin/env python
"""Emit word-level vocabulary sheets from the extracted Wortliste entries.

Merges each collection's pages/_vocab/chunk-*.json (produced by
vocabulary.workflow.js) and writes:

  <collection>/<collection>-vocabulary.csv   one row per word entry:
      collection, word, article, plural, word_class, example, topic, source_page
  <family>-a1-vocabulary-all.csv   per-publisher combined (goethe|netzwerk|goyal)
  (the global german-a1-vocabulary-all.csv is built by merge_all.py)

De-duplicates on (word, article, source_page) in case chunks overlap.
CSVs are UTF-8 with BOM so Excel shows umlauts correctly. Re-runnable.

Usage:
    python _tools/vocabulary.py --all
    python _tools/vocabulary.py <slug> [<slug>…]
"""
import csv
import glob
import json
import os
import sys
from collections import defaultdict

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)  # german/extracted/
CONFIG = os.path.join(TOOLS, 'collections.json')
COLUMNS = ['collection', 'word', 'article', 'plural', 'word_class', 'example', 'topic', 'source_page']


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


def load_entries(slug):
    """Merge every chunk file for a collection; returns None if none exist."""
    paths = sorted(glob.glob(os.path.join(ROOT, slug, 'pages', '_vocab', 'chunk-*.json')))
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


def main(argv):
    cols = load_collections()
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug.')
        return

    flat = lambda v: ' '.join(str(v).split())  # keep every value one clean cell
    by_family = defaultdict(list)
    for c in targets:
        slug = c['slug']
        if c.get('frozen'):
            print('%-32s frozen — skipped' % slug)
            continue
        entries = load_entries(slug)
        if entries is None:
            continue  # not a vocabulary collection / not extracted
        rows = [{
            'collection': slug,
            'word': flat(e.get('word', '')), 'article': flat(e.get('article', '')),
            'plural': flat(e.get('plural', '')), 'word_class': flat(e.get('word_class', '')),
            'example': flat(e.get('example', '')), 'topic': flat(e.get('topic', '')),
            'source_page': flat(e.get('source_page', '')),
        } for e in entries]
        with open(os.path.join(ROOT, slug, '%s-vocabulary.csv' % slug), 'w',
                  encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(rows)
        by_family[c.get('family', 'german')].extend(rows)
        nouns = sum(1 for r in rows if r['word_class'] == 'noun')
        withex = sum(1 for r in rows if r['example'])
        print('%-32s %4d words (%d nouns, %d with examples) -> %s-vocabulary.csv'
              % (slug, len(rows), nouns, withex, slug))

    for fam, rows in by_family.items():
        path = os.path.join(ROOT, '%s-a1-vocabulary-all.csv' % fam)
        with open(path, 'w', encoding='utf-8-sig', newline='') as cf:
            cw = csv.DictWriter(cf, fieldnames=COLUMNS)
            cw.writeheader()
            cw.writerows(rows)
        print('per-family sheet -> %s (%d words)' % (os.path.basename(path), len(rows)))


if __name__ == '__main__':
    main(sys.argv[1:])
