#!/usr/bin/env python
"""Manifest + dashboard tooling for the French PDF extraction.

The authoritative per-page state lives in extracted/manifest.tsv (one row per page).
MANIFEST.md is a HUMAN dashboard regenerated from the TSV.

Usage:
    python _tools/manifest.py init        # create manifest.tsv (idempotent; won't clobber)
    python _tools/manifest.py dashboard    # regenerate MANIFEST.md from manifest.tsv
"""
import os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # extracted/
TSV = os.path.join(ROOT, 'manifest.tsv')
MD = os.path.join(ROOT, 'MANIFEST.md')
COLS = ['book', 'page', 'status', 'orientation', 'content_type', 'level', 'section', 'qa', 'notes']
BOOKS = [('conjugaison-a1-a2', 'PRATIQUE-CONJUGASION A1 A2.pdf'),
         ('revision-2', 'Pratique Révision 2.pdf')]
# status: pending -> transcribed -> verified  (or failed). qa: ''/pending/pass/fail


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
    if os.path.exists(TSV):
        print('manifest.tsv already exists; not overwriting. (%d rows)' % len(read_rows()))
        return
    rows = []
    for slug, _src in BOOKS:
        imgs = sorted(glob.glob(os.path.join(ROOT, slug, 'images', 'page-*.png')))
        for p in range(1, len(imgs) + 1):
            rows.append({'book': slug, 'page': '%03d' % p, 'status': 'pending',
                         'orientation': 'unknown', 'content_type': '', 'level': '',
                         'section': '', 'qa': 'pending', 'notes': ''})
    write_rows(rows)
    print('Initialized manifest.tsv with %d rows.' % len(rows))


def dashboard():
    rows = read_rows()
    by_book = {}
    for r in rows:
        by_book.setdefault(r['book'], []).append(r)
    out = []
    out.append('# Extraction MANIFEST — resume tracker\n')
    out.append('> Authoritative per-page state is in `manifest.tsv`. This file is regenerated from it via `python _tools/manifest.py dashboard`.\n')
    out.append('> **To resume in a new chat:** read this file, then process pages whose `status` is not `verified` (transcribe -> QA), updating `manifest.tsv`.\n')
    tot = len(rows)
    t_tr = sum(1 for r in rows if r['status'] in ('transcribed', 'verified'))
    t_ve = sum(1 for r in rows if r['status'] == 'verified')
    out.append('\n## Overall\n')
    out.append('| Metric | Count | %% |')
    out.append('|---|---|---|')
    out.append('| Pages total | %d | 100%% |' % tot)
    out.append('| Transcribed | %d | %d%% |' % (t_tr, round(100 * t_tr / tot) if tot else 0))
    out.append('| QA-verified | %d | %d%% |' % (t_ve, round(100 * t_ve / tot) if tot else 0))
    for slug, src in BOOKS:
        rs = by_book.get(slug, [])
        n = len(rs)
        tr = sum(1 for r in rs if r['status'] in ('transcribed', 'verified'))
        ve = sum(1 for r in rs if r['status'] == 'verified')
        pend = [r['page'] for r in rs if r['status'] == 'pending']
        out.append('\n## %s  (`%s`)\n' % (slug, src))
        out.append('- Pages: **%d** | Transcribed: **%d (%d%%)** | Verified: **%d (%d%%)**' %
                   (n, tr, round(100 * tr / n) if n else 0, ve, round(100 * ve / n) if n else 0))
        if pend:
            rng = '%s … %s' % (pend[0], pend[-1]) if len(pend) > 1 else pend[0]
            out.append('- Next pending pages (%d): %s' % (len(pend), rng))
        else:
            out.append('- No pending pages. ✅')
    with open(MD, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    print('Wrote dashboard: overall %d/%d transcribed, %d/%d verified.' % (t_tr, tot, t_ve, tot))


def _frontmatter(path):
    """Parse the leading YAML frontmatter of a markdown file into a dict (string values)."""
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


def sync():
    """Reconcile per-page results (pages/*.md frontmatter) into manifest.tsv (single process, no races)."""
    rows = read_rows()
    index = {(r['book'], r['page']): r for r in rows}
    updated = 0
    for slug, _src in BOOKS:
        for md in sorted(glob.glob(os.path.join(ROOT, slug, 'pages', 'page-*.md'))):
            page = os.path.basename(md)[5:8]
            r = index.get((slug, page))
            if not r:
                continue
            fm = _frontmatter(md)
            for col in ('status', 'orientation', 'content_type', 'level', 'section', 'qa'):
                if fm.get(col):
                    r[col] = fm[col].replace('\t', ' ')
            updated += 1
    write_rows(rows)
    print('Synced %d page files into manifest.tsv.' % updated)
    dashboard()


import re, json


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
    new = '---\n' + '\n'.join(lines) + '\n---\n' + rest
    open(path, 'w', encoding='utf-8').write(new)
    return True


def qa_apply():
    """Reconcile QA verdict sidecars (pages/_qa/page-NNN.json) into page frontmatter, then sync manifest."""
    applied = 0
    for slug, _src in BOOKS:
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
            # refresh the QA ISSUES comment at end of file
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
