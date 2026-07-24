#!/usr/bin/env python
"""Manifest + dashboard tooling for a language's PDF/audio (media) pipeline.

Shared across every language via --root <path/to/lang/extracted>. Same
design German proved out: one TSV as the resume anchor, folded from/synced
to each page's own frontmatter (the frontmatter is the real source of
truth; the TSV is a derived, rebuildable cache).

Schema (manifest-media.tsv):
    collection  unit  source_type  status  orientation  content_type  level  section  qa  notes
  where unit = 'page-NNN' (source_type=pdf) or 'listening' (source_type=audio).
  status: pending -> transcribed -> verified (or failed). qa: ''/pending/pass/fail.

All writes go through _common.atomic_open/atomic_write_text — a process
killed mid-write leaves the previous good file untouched, never a
truncated one.

Usage:
    python _engine/manifest_media.py --root french/extracted init
    python _engine/manifest_media.py --root french/extracted dashboard
    python _engine/manifest_media.py --root french/extracted sync
    python _engine/manifest_media.py --root french/extracted qa-apply
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, load_collection_list, atomic_open, atomic_write_text

COLS = ['collection', 'unit', 'source_type', 'status', 'orientation',
        'content_type', 'level', 'section', 'qa', 'notes']


def _tsv(root):
    return os.path.join(root, 'manifest-media.tsv')


def _md(root):
    return os.path.join(root, 'MANIFEST-MEDIA.md')


def read_rows(root):
    rows = []
    tsv = _tsv(root)
    if not os.path.exists(tsv):
        return rows
    with open(tsv, encoding='utf-8') as f:
        lines = f.read().splitlines()
    for ln in lines[1:]:
        if not ln.strip():
            continue
        parts = ln.split('\t')
        parts += [''] * (len(COLS) - len(parts))
        rows.append(dict(zip(COLS, parts)))
    return rows


def write_rows(root, rows):
    with atomic_open(_tsv(root), 'w', encoding='utf-8', newline='') as f:
        f.write('\t'.join(COLS) + '\n')
        for r in rows:
            f.write('\t'.join(str(r.get(c, '')) for c in COLS) + '\n')


def init(root):
    """Additive + idempotent: seed rows for any (collection, unit) not already
    present, never clobbering existing state. Safe to re-run after adding a
    collection or rasterising more pages."""
    rows = read_rows(root)
    have = {(r['collection'], r['unit']) for r in rows}
    added = 0
    for c in load_collection_list(root):
        slug, level = c['slug'], c.get('level', '')
        imgs = sorted(glob.glob(os.path.join(root, slug, 'images', 'page-*.png')))
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
    write_rows(root, rows)
    print('init: added %d new rows (%d total).' % (added, len(rows)))


def dashboard(root):
    rows = read_rows(root)
    by_col = {}
    for r in rows:
        by_col.setdefault(r['collection'], []).append(r)
    out = ['# Media MANIFEST - PDF + audio resume tracker\n']
    out.append('> Authoritative per-unit state is in `manifest-media.tsv`. '
                'Regenerate via `python _engine/manifest_media.py --root <lang>/extracted dashboard`.\n')
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
    for c in load_collection_list(root):
        slug = c['slug']
        rs = by_col.get(slug, [])
        if not rs:
            continue
        pages = [r for r in rs if r['source_type'] == 'pdf']
        aud = [r for r in rs if r['source_type'] == 'audio']
        p_tr = sum(1 for r in pages if r['status'] in ('transcribed', 'verified'))
        p_ve = sum(1 for r in pages if r['status'] == 'verified')
        pend = [r['unit'] for r in pages if r['status'] == 'pending']
        out.append('\n## %s  (`%s` - %s)\n' % (slug, c.get('pdf', ''), c.get('level', '')))
        out.append('- PDF pages: **%d** | Transcribed: **%d (%d%%)** | Verified: **%d (%d%%)**' %
                    (len(pages), p_tr, round(100 * p_tr / len(pages)) if pages else 0,
                     p_ve, round(100 * p_ve / len(pages)) if pages else 0))
        if pend:
            out.append('- Next pending pages (%d): %s' %
                        (len(pend), '%s ... %s' % (pend[0], pend[-1]) if len(pend) > 1 else pend[0]))
        else:
            out.append('- No pending pages.')
        if aud:
            a = aud[0]
            out.append('- Audio: **%s** (status: %s, qa: %s)' % (a['unit'], a['status'], a['qa'] or '-'))
    atomic_write_text(_md(root), '\n'.join(out) + '\n')
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
    atomic_write_text(path, '---\n' + '\n'.join(lines) + '\n---\n' + rest)
    return True


def sync(root):
    rows = read_rows(root)
    index = {(r['collection'], r['unit']): r for r in rows}
    updated = 0
    for c in load_collection_list(root):
        slug = c['slug']
        for md in sorted(glob.glob(os.path.join(root, slug, 'pages', 'page-*.md'))):
            unit = 'page-' + os.path.basename(md)[5:8]
            r = index.get((slug, unit))
            if not r:
                continue
            fm = _frontmatter(md)
            for col in ('status', 'orientation', 'content_type', 'level', 'section', 'qa'):
                if fm.get(col):
                    r[col] = fm[col].replace('\t', ' ')
            updated += 1
        amd = os.path.join(root, slug, 'audio', 'listening.md')
        if os.path.exists(amd):
            r = index.get((slug, 'listening'))
            if r:
                fm = _frontmatter(amd)
                for col in ('status', 'level', 'section', 'qa'):
                    if fm.get(col):
                        r[col] = fm[col].replace('\t', ' ')
                updated += 1
    write_rows(root, rows)
    print('Synced %d unit files into manifest-media.tsv.' % updated)
    dashboard(root)


def qa_apply(root):
    applied = 0
    for c in load_collection_list(root):
        slug = c['slug']
        for sc in sorted(glob.glob(os.path.join(root, slug, 'pages', '_qa', 'page-*.json'))):
            page = os.path.basename(sc)[5:8]
            md = os.path.join(root, slug, 'pages', 'page-%s.md' % page)
            if not os.path.exists(md):
                continue
            try:
                v = json.load(open(sc, encoding='utf-8'))
            except Exception:
                continue
            ok = v.get('ok') is True
            _set_frontmatter(md, {'status': 'verified' if ok else 'transcribed',
                                   'qa': 'pass' if ok else 'fail'})
            txt = open(md, encoding='utf-8').read()
            txt = re.sub(r'\n*<!-- QA ISSUES:.*?-->\n*', '\n', txt, flags=re.S).rstrip() + '\n'
            if not ok and v.get('issues'):
                txt += '\n<!-- QA ISSUES:\n' + '\n'.join('- ' + str(i) for i in v['issues']) + '\n-->\n'
            atomic_write_text(md, txt)
            applied += 1
    print('Applied %d QA verdicts.' % applied)
    sync(root)


if __name__ == '__main__':
    argv = sys.argv[1:]
    root = parse_root(argv)
    cmd = argv[0] if argv else 'dashboard'
    {'init': init, 'dashboard': dashboard, 'sync': sync, 'qa-apply': qa_apply}.get(cmd, dashboard)(root)
