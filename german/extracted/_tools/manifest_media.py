#!/usr/bin/env python
"""Manifest + dashboard tooling for the German PDF/audio (media) pipeline.

Mirrors french/extracted/_tools/manifest.py, but:
  - operates on a SEPARATE file, manifest-media.tsv (the web manifest.tsv is
    owned by the TypeScript module and is never touched here);
  - covers TWO source types in one file: PDF pages and audio tracks;
  - is driven by collections.json (no hardcoded collection list).

Schema (manifest-media.tsv):
    collection  unit  source_type  status  orientation  content_type  level  section  qa  notes
  where unit = 'page-NNN' (source_type=pdf) or 'listening' (source_type=audio).
  status: pending -> transcribed -> verified (or failed). qa: ''/pending/pass/fail.

Usage:
    python _tools/manifest_media.py init        # seed rows from images/ + audio config (idempotent)
    python _tools/manifest_media.py dashboard   # regenerate MANIFEST-MEDIA.md
    python _tools/manifest_media.py sync         # read page/audio frontmatter back into the TSV
    python _tools/manifest_media.py qa-apply     # fold pages/_qa/*.json verdicts into frontmatter, then sync
"""
import glob
import json
import os
import re
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)  # german/extracted/
TSV = os.path.join(ROOT, 'manifest-media.tsv')
MD = os.path.join(ROOT, 'MANIFEST-MEDIA.md')
CONFIG = os.path.join(TOOLS, 'collections.json')
COLS = ['collection', 'unit', 'source_type', 'status', 'orientation',
        'content_type', 'level', 'section', 'qa', 'notes']


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


def read_rows():
    rows = []
    if not os.path.exists(TSV):
        return rows
    with open(TSV, encoding='utf-8') as f:
        lines = f.read().splitlines()
    for ln in lines[1:]:
        if not ln.strip():
            continue
        parts = ln.split('\t')
        parts += [''] * (len(COLS) - len(parts))
        rows.append(dict(zip(COLS, parts)))
    return rows


def write_rows(rows):
    with open(TSV, 'w', encoding='utf-8', newline='') as f:
        f.write('\t'.join(COLS) + '\n')
        for r in rows:
            f.write('\t'.join(str(r.get(c, '')) for c in COLS) + '\n')


def init():
    """Additive + idempotent: seed rows for any (collection, unit) not already
    present, never clobbering existing state. Safe to re-run after adding a
    collection or rasterising more pages."""
    rows = read_rows()
    have = {(r['collection'], r['unit']) for r in rows}
    added = 0
    for c in load_collections():
        slug, level = c['slug'], c.get('level', '')
        imgs = sorted(glob.glob(os.path.join(ROOT, slug, 'images', 'page-*.png')))
        for p in range(1, len(imgs) + 1):
            key = (slug, 'page-%03d' % p)
            if key in have:
                continue
            rows.append({'collection': slug, 'unit': 'page-%03d' % p, 'source_type': 'pdf',
                         'status': 'pending', 'orientation': 'unknown', 'content_type': '',
                         'level': level, 'section': '', 'qa': 'pending', 'notes': ''})
            added += 1
        if c.get('audio') and (slug, 'listening') not in have:
            rows.append({'collection': slug, 'unit': 'listening', 'source_type': 'audio',
                         'status': 'pending', 'orientation': '', 'content_type': 'listening-audio',
                         'level': level, 'section': '', 'qa': 'pending', 'notes': ''})
            added += 1
    write_rows(rows)
    print('init: added %d new rows (%d total).' % (added, len(rows)))


def dashboard():
    rows = read_rows()
    by_col = {}
    for r in rows:
        by_col.setdefault(r['collection'], []).append(r)
    out = ['# Media MANIFEST — PDF + audio resume tracker\n']
    out.append('> Authoritative per-unit state is in `manifest-media.tsv` '
               '(separate from the web `manifest.tsv`). Regenerate via '
               '`python _tools/manifest_media.py dashboard`.\n')
    out.append('> Resume: process units whose `status` is not `verified`.\n')
    tot = len(rows)
    tr = sum(1 for r in rows if r['status'] in ('transcribed', 'verified'))
    ve = sum(1 for r in rows if r['status'] == 'verified')
    out.append('\n## Overall\n')
    out.append('| Metric | Count | %% |')
    out.append('|---|---|---|')
    out.append('| Units total | %d | 100%% |' % tot)
    out.append('| Transcribed | %d | %d%% |' % (tr, round(100 * tr / tot) if tot else 0))
    out.append('| Verified | %d | %d%% |' % (ve, round(100 * ve / tot) if tot else 0))
    for c in load_collections():
        slug = c['slug']
        rs = by_col.get(slug, [])
        if not rs:
            continue
        pages = [r for r in rs if r['source_type'] == 'pdf']
        aud = [r for r in rs if r['source_type'] == 'audio']
        p_tr = sum(1 for r in pages if r['status'] in ('transcribed', 'verified'))
        p_ve = sum(1 for r in pages if r['status'] == 'verified')
        pend = [r['unit'] for r in pages if r['status'] == 'pending']
        out.append('\n## %s  (`%s` · %s)\n' % (slug, c.get('pdf', ''), c.get('level', '')))
        out.append('- PDF pages: **%d** | Transcribed: **%d (%d%%)** | Verified: **%d (%d%%)**' %
                   (len(pages), p_tr, round(100 * p_tr / len(pages)) if pages else 0,
                    p_ve, round(100 * p_ve / len(pages)) if pages else 0))
        if pend:
            out.append('- Next pending pages (%d): %s' %
                       (len(pend), '%s … %s' % (pend[0], pend[-1]) if len(pend) > 1 else pend[0]))
        else:
            out.append('- No pending pages. ✅')
        if aud:
            a = aud[0]
            out.append('- Audio: **%s** (status: %s, qa: %s)' % (a['unit'], a['status'], a['qa'] or '—'))
    with open(MD, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    print('Wrote dashboard: %d/%d transcribed, %d/%d verified.' % (tr, tot, ve, tot))


def _frontmatter(path):
    fm = {}
    try:
        with open(path, encoding='utf-8') as f:
            txt = f.read()
    except Exception:
        return fm
    if not txt.startswith('---'):
        return fm
    end = txt.find('\n---', 3)
    if end == -1:
        return fm
    for ln in txt[3:end].splitlines():
        if ':' in ln:
            k, v = ln.split(':', 1)
            fm[k.strip()] = v.strip()
    return fm


def _set_frontmatter(path, updates):
    txt = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n?', txt, re.S)
    if not m:
        return False
    lines = m.group(1).split('\n')
    rest = txt[m.end():]
    seen = set()
    for i, ln in enumerate(lines):
        if ':' in ln:
            k = ln.split(':', 1)[0].strip()
            if k in updates:
                lines[i] = '%s: %s' % (k, updates[k])
                seen.add(k)
    for k, v in updates.items():
        if k not in seen:
            lines.append('%s: %s' % (k, v))
    open(path, 'w', encoding='utf-8').write('---\n' + '\n'.join(lines) + '\n---\n' + rest)
    return True


def sync():
    rows = read_rows()
    index = {(r['collection'], r['unit']): r for r in rows}
    updated = 0
    for c in load_collections():
        slug = c['slug']
        for md in sorted(glob.glob(os.path.join(ROOT, slug, 'pages', 'page-*.md'))):
            unit = 'page-' + os.path.basename(md)[5:8]
            r = index.get((slug, unit))
            if not r:
                continue
            fm = _frontmatter(md)
            for col in ('status', 'orientation', 'content_type', 'level', 'section', 'qa'):
                if fm.get(col):
                    r[col] = fm[col].replace('\t', ' ')
            updated += 1
        amd = os.path.join(ROOT, slug, 'audio', 'listening.md')
        if os.path.exists(amd):
            r = index.get((slug, 'listening'))
            if r:
                fm = _frontmatter(amd)
                for col in ('status', 'level', 'section', 'qa'):
                    if fm.get(col):
                        r[col] = fm[col].replace('\t', ' ')
                updated += 1
    write_rows(rows)
    print('Synced %d unit files into manifest-media.tsv.' % updated)
    dashboard()


def qa_apply():
    applied = 0
    for c in load_collections():
        slug = c['slug']
        for sc in sorted(glob.glob(os.path.join(ROOT, slug, 'pages', '_qa', 'page-*.json'))):
            page = os.path.basename(sc)[5:8]
            md = os.path.join(ROOT, slug, 'pages', 'page-%s.md' % page)
            if not os.path.exists(md):
                continue
            try:
                v = json.load(open(sc, encoding='utf-8'))
            except Exception:
                continue
            ok = bool(v.get('ok'))
            _set_frontmatter(md, {'status': 'verified' if ok else 'transcribed',
                                  'qa': 'pass' if ok else 'fail'})
            txt = open(md, encoding='utf-8').read()
            txt = re.sub(r'\n*<!-- QA ISSUES:.*?-->\n*', '\n', txt, flags=re.S).rstrip() + '\n'
            if not ok and v.get('issues'):
                txt += '\n<!-- QA ISSUES:\n' + '\n'.join('- ' + str(i) for i in v['issues']) + '\n-->\n'
            open(md, 'w', encoding='utf-8').write(txt)
            applied += 1
    print('Applied %d QA verdicts.' % applied)
    sync()


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'dashboard'
    {'init': init, 'dashboard': dashboard, 'sync': sync, 'qa-apply': qa_apply}.get(cmd, dashboard)()
