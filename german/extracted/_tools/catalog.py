#!/usr/bin/env python
"""Build per-PDF deliverables from the transcribed pages:

  <collection>/<collection>.md   ONE unified Markdown document per PDF — an
                                  overview table (grouped by skill section +
                                  content type) followed by every page's body
                                  concatenated in order.
  <collection>/catalog.csv        A columned, filterable sheet (one row per
                                  page) — opens in Excel/Google Sheets with
                                  native filters (Data -> Filter).

Also writes a combined german/extracted/catalog-all.csv across every collection.

Reads the per-page pages/page-NNN.md files (frontmatter + body). Pure Python,
read-only w.r.t. the extraction pipeline. Re-runnable anytime.

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
COLUMNS = ['collection', 'unit', 'section', 'content_type', 'level', 'status', 'qa', 'word_count', 'title']


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


def split_frontmatter(txt):
    """Return (frontmatter_dict, body_str)."""
    fm = {}
    body = txt
    m = re.match(r'^---\n(.*?)\n---\n?', txt, re.S)
    if m:
        for ln in m.group(1).splitlines():
            if ':' in ln:
                k, v = ln.split(':', 1)
                fm[k.strip()] = v.strip()
        body = txt[m.end():]
    return fm, body


def page_title(body):
    """First heading, else first non-empty line, trimmed to ~90 chars."""
    for ln in body.splitlines():
        s = ln.strip()
        if not s:
            continue
        s = re.sub(r'^#+\s*', '', s)
        s = re.sub(r'[*_`>|\[\]]', '', s).strip()
        if s:
            return s[:90]
    return ''


def human_title(c):
    variant = (c.get('variant') or '').replace('-', ' ').title()
    doc = os.path.splitext(os.path.basename(c.get('pdf', c['slug'])))[0].replace('-', ' ').title()
    return 'Goethe-Zertifikat %s · %s · %s' % (c.get('level', ''), variant, doc)


def read_pages(slug):
    """Yield (unit, frontmatter, body) per page in order."""
    for md in sorted(glob.glob(os.path.join(ROOT, slug, 'pages', 'page-*.md'))):
        unit = 'page-' + os.path.basename(md)[5:8]
        fm, body = split_frontmatter(open(md, encoding='utf-8').read())
        yield unit, fm, body.strip()


def build_collection(c, combined_writer):
    slug = c['slug']
    rows = []
    unified = []
    for unit, fm, body in read_pages(slug):
        wc = len(re.findall(r'\S+', body))
        row = {
            'collection': slug, 'unit': unit,
            'section': fm.get('section', '').strip('"') or '',
            'content_type': fm.get('content_type', '') or '',
            'level': fm.get('level', c.get('level', '')),
            'status': fm.get('status', ''), 'qa': fm.get('qa', ''),
            'word_count': wc, 'title': page_title(body),
        }
        rows.append(row)
        if combined_writer:
            combined_writer.writerow(row)
        hdr = '## %s' % unit.replace('page-', 'Page ')
        tags = ' · '.join(t for t in [row['section'], row['content_type']] if t)
        if tags:
            hdr += '  — %s' % tags
        unified.append('%s\n\n%s' % (hdr, body if body else '_(empty)_'))

    if not rows:
        print('%-32s no pages yet, skipped' % slug)
        return

    # per-PDF sheet (descriptive filename so it's identifiable on its own)
    with open(os.path.join(ROOT, slug, '%s-catalog.csv' % slug), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    # grouped overview counts
    by_section, by_ctype = {}, {}
    for r in rows:
        by_section[r['section'] or '(none)'] = by_section.get(r['section'] or '(none)', 0) + 1
        for ct in re.findall(r'[\w-]+', r['content_type']):
            by_ctype[ct] = by_ctype.get(ct, 0) + 1

    ov = ['# %s\n' % human_title(c),
          '> Unified transcription of `%s` — %d pages. Source: Goethe-Institut (official free practice material).' % (c.get('pdf', ''), len(rows)),
          '> Generated %s from per-page files in `pages/`. Filterable sheet: `%s-catalog.csv`.\n' % (datetime.now().strftime('%Y-%m-%d'), slug),
          '## Overview\n',
          '**By skill section**\n', '| Section | Pages |', '|---|---|']
    for k in sorted(by_section):
        ov.append('| %s | %d |' % (k, by_section[k]))
    ov += ['\n**By content type**\n', '| Content type | Pages |', '|---|---|']
    for k in sorted(by_ctype):
        ov.append('| %s | %d |' % (k, by_ctype[k]))
    ov.append('\n---\n')

    with open(os.path.join(ROOT, slug, '%s.md' % slug), 'w', encoding='utf-8') as f:
        f.write('\n'.join(ov) + '\n' + '\n\n'.join(unified) + '\n')

    print('%-32s %3d pages -> %s.md + %s-catalog.csv' % (slug, len(rows), slug, slug))


def main(argv):
    cols = load_collections()
    if '--all' in argv:
        targets = cols
    else:
        wanted = set(argv)
        targets = [c for c in cols if c['slug'] in wanted]
    if not targets:
        print('No matching collections. Use --all or a slug.')
        return

    combined_path = os.path.join(ROOT, 'goethe-a1-catalog-all.csv')
    with open(combined_path, 'w', encoding='utf-8', newline='') as cf:
        cw = csv.DictWriter(cf, fieldnames=COLUMNS)
        cw.writeheader()
        for c in targets:
            build_collection(c, cw)
    print('Combined sheet -> %s' % combined_path)


if __name__ == '__main__':
    main(sys.argv[1:])
