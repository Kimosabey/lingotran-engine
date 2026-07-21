#!/usr/bin/env python
"""Build per-PDF deliverables from the transcribed pages + classification.

  <collection>/<collection>.md   ONE unified Markdown document per PDF:
                                  overview (grouped by section / content-type /
                                  activity / topic) + a scannable PAGE INDEX
                                  (page · section · activity · topic · summary)
                                  + every page's body concatenated in order.
  <collection>/<collection>-catalog.csv   columned, filterable sheet (one row per
                                  page) — opens in Excel/Google Sheets (Data->Filter).

Also writes a combined german/extracted/goethe-a1-catalog-all.csv across all collections.

Merges optional per-collection classification from pages/_class.json (produced by
classify.workflow.js): activity_type, topic, summary. Runs fine without it (those
columns stay blank). Pure Python, read-only w.r.t. the pipeline; re-runnable.

Usage:
    python _tools/catalog.py --all
    python _tools/catalog.py <slug> [<slug>…]
"""
import csv
import glob
import json
import os
import re
import sys
from datetime import datetime

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)  # german/extracted/
CONFIG = os.path.join(TOOLS, 'collections.json')
COLUMNS = ['collection', 'unit', 'section', 'content_type', 'activity_type', 'topic',
           'level', 'status', 'qa', 'word_count', 'summary', 'title']


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


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
    variant = (c.get('variant') or '').replace('-', ' ').title()
    doc = os.path.splitext(os.path.basename(c.get('pdf', c['slug'])))[0].replace('-', ' ').title()
    return 'Goethe-Zertifikat %s · %s · %s' % (c.get('level', ''), variant, doc)


def load_classification(slug):
    path = os.path.join(ROOT, slug, 'pages', '_class.json')
    cmap = {}
    if os.path.exists(path):
        try:
            data = json.load(open(path, encoding='utf-8'))
            for it in data.get('items', []):
                cmap[int(it['page'])] = it
        except Exception:
            pass
    return cmap


def read_pages(slug):
    for md in sorted(glob.glob(os.path.join(ROOT, slug, 'pages', 'page-*.md'))):
        unit = 'page-' + os.path.basename(md)[5:8]
        fm, body = split_frontmatter(open(md, encoding='utf-8').read())
        yield unit, fm, body.strip()


def _counts(rows, key, split=False):
    out = {}
    for r in rows:
        if split:
            for v in re.findall(r'[\w-]+', r[key]):
                out[v] = out.get(v, 0) + 1
        else:
            k = r[key] or '(none)'
            out[k] = out.get(k, 0) + 1
    return out


def _table(title, counts, col='Count'):
    lines = ['**%s**\n' % title, '| %s | %s |' % (title.split(' ', 1)[-1], col), '|---|---|']
    for k in sorted(counts, key=lambda x: (-counts[x], x)):
        lines.append('| %s | %d |' % (k, counts[k]))
    return lines


def build_collection(c, combined_writer):
    slug = c['slug']
    cmap = load_classification(slug)
    rows, unified = [], []
    for unit, fm, body in read_pages(slug):
        pg = int(unit[5:])
        cl = cmap.get(pg, {})
        row = {
            'collection': slug, 'unit': unit,
            'section': fm.get('section', '').strip('"') or '',
            'content_type': fm.get('content_type', '') or '',
            'activity_type': cl.get('activity_type', ''),
            'topic': cl.get('topic', ''),
            'level': fm.get('level', c.get('level', '')),
            'status': fm.get('status', ''), 'qa': fm.get('qa', ''),
            'word_count': len(re.findall(r'\S+', body)),
            'summary': cl.get('summary', ''), 'title': page_title(body),
        }
        rows.append(row)
        if combined_writer:
            combined_writer.writerow(row)
        tags = ' · '.join(t for t in [row['section'], row['content_type'], row['activity_type'], row['topic']] if t)
        hdr = '## %s' % unit.replace('page-', 'Page ')
        if tags:
            hdr += '  — %s' % tags
        unified.append('%s\n\n%s' % (hdr, body if body else '_(empty)_'))

    if not rows:
        print('%-32s no pages yet, skipped' % slug)
        return

    # per-PDF sheet
    with open(os.path.join(ROOT, slug, '%s-catalog.csv' % slug), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    # unified .md: title + overview tables + page index + full body
    ov = ['# %s\n' % human_title(c),
          '> Unified transcription of `%s` — %d pages. Source: Goethe-Institut (official free practice material).' % (c.get('pdf', ''), len(rows)),
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

    with open(os.path.join(ROOT, slug, '%s.md' % slug), 'w', encoding='utf-8') as f:
        f.write('\n'.join(ov) + '\n' + '\n\n'.join(unified) + '\n')

    classified = sum(1 for r in rows if r['activity_type'])
    print('%-32s %3d pages (%d classified) -> %s.md + %s-catalog.csv' % (slug, len(rows), classified, slug, slug))


def main(argv):
    cols = load_collections()
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug.')
        return
    combined_path = os.path.join(ROOT, 'goethe-a1-catalog-all.csv')
    with open(combined_path, 'w', encoding='utf-8-sig', newline='') as cf:
        cw = csv.DictWriter(cf, fieldnames=COLUMNS)
        cw.writeheader()
        for c in targets:
            build_collection(c, cw)
    print('Combined sheet -> %s' % combined_path)


if __name__ == '__main__':
    main(sys.argv[1:])
