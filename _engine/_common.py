#!/usr/bin/env python
"""Shared helpers for every _engine/*.py tool.

Two responsibilities, and only these two:
  1. --root resolution (parse_root/lang_slug/lang_dir/load_collections) — the
     multi-language convention: every tool takes --root <path/to/lang/extracted>,
     never a hardcoded language name or path.
  2. atomic_open/atomic_write_text — the one concrete fix adopted from the
     architecture review: never leave a half-written file on disk if a process
     dies mid-write. Every writer in this engine should use these instead of
     bare open(path, 'w').

Deliberately NOT here: a job queue, a model gateway, telemetry, schema
validation. Those were reviewed and judged over-engineered for how this
actually runs (one human orchestrator, one book at a time, confirm-gated) —
see PLAYBOOK.md and the architecture-review conversation for why.
"""
import contextlib
import glob
import json
import os
import re
import sys
import tempfile


def parse_root(argv):
    """Pop '--root <path>' from argv (mutates argv); return its absolute path.
    Required — there is no default and no hardcoded fallback, by design."""
    if '--root' not in argv:
        print('Error: --root <path/to/lang/extracted> is required (e.g. --root french/extracted)')
        sys.exit(1)
    i = argv.index('--root')
    root = os.path.abspath(argv[i + 1])
    del argv[i:i + 2]
    return root


def lang_slug(root):
    """'.../french/extracted' -> 'french' — derived, never re-typed."""
    return os.path.basename(os.path.dirname(root))


def lang_dir(root):
    """'.../french/extracted' -> '.../french' (where pdf/ and audio/ live)."""
    return os.path.dirname(root)


def load_collections(root):
    path = os.path.join(root, '_tools', 'collections.json')
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def load_collection_list(root):
    return load_collections(root)['collections']


@contextlib.contextmanager
def atomic_open(path, mode='w', encoding='utf-8', newline=None):
    """Write to a temp file in the SAME directory as `path`, then atomically
    replace `path` with it only on a clean exit (os.replace is atomic on both
    POSIX and Windows). If the block raises — including the process being
    killed, though that can't run cleanup, only a graceful exception — the
    temp file is removed and `path` is left completely untouched: never a
    truncated/half-written file sitting where a completed one is expected.

    Works with anything that takes a file handle: f.write(text), json.dump(f),
    csv.writer(f) — same call shape as a normal open(), just safer.

        with atomic_open(path, 'w', encoding='utf-8-sig', newline='') as f:
            csv.writer(f).writerows(rows)
    """
    d = os.path.dirname(os.path.abspath(path)) or '.'
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix='.tmp-atomic-', suffix='.part')
    os.close(fd)
    try:
        with open(tmp, mode, encoding=encoding, newline=newline) as f:
            yield f
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def atomic_write_text(path, text, encoding='utf-8', newline='\n'):
    """Convenience wrapper of atomic_open for the common "write one string" case.

    `newline` defaults to '\\n' rather than open()'s None, which would translate
    every '\\n' to os.linesep and make output platform-dependent: LF on Linux,
    CRLF on Windows, for byte-identical input. Derived files that differ by
    platform defeat any byte-level comparison against what was committed -- see
    check_exports_current.py. Text this pipeline writes is LF everywhere.
    """
    with atomic_open(path, 'w', encoding=encoding, newline=newline) as f:
        f.write(text)


def atomic_save_image(img, path):
    """Same guarantee as atomic_open, for a PIL Image saved over its own source
    (rotate.py's overwrite-in-place). A process killed mid-save leaves the
    previous good file untouched instead of a truncated/corrupted PNG."""
    d = os.path.dirname(os.path.abspath(path)) or '.'
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix='.tmp-atomic-', suffix='.png')
    os.close(fd)
    try:
        img.save(tmp)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def build_start_here(language, books, combined=None, generator='package_exports.py',
                     provenance=None):
    """The content team's orientation page for a language's deliverable.

    README.md is a reference (column lists, row counts). This is the "what do I
    open and why" page for someone who has never seen the folder. Every
    language gets one, generated from the same code and the same real numbers,
    so it cannot drift from what actually shipped -- German used to hardcode
    its own prose inside its packager and French had none at all, which meant
    the two deliverables did not even have the same shape.

    `books` is a list of dicts: title, folder, pages, questions, words,
    caveats, frozen. `combined` is [(filename, rows), ...] or None.
    Deliberately data-driven and language-neutral: nothing here names a
    publisher, a level or a language beyond `language` itself.
    """
    books = books or []
    live = [b for b in books if b.get('pages') or b.get('questions') or b.get('words')]
    tot_pages = sum(b.get('pages') or 0 for b in live)
    tot_q = sum(b.get('questions') or 0 for b in live)
    tot_w = sum(b.get('words') or 0 for b in live)

    L = ['# START HERE — %s datasets' % language.title(), '']
    if live:
        L += ['This folder is the finished, ready-to-use %s material: **%s pages** from '
              '**%d book%s**, turned into clean spreadsheets. Every page was transcribed '
              'word-for-word from the printed book and independently re-checked, so what '
              'you see matches the source.'
              % (language.title(), '{:,}'.format(tot_pages), len(live),
                 '' if len(live) == 1 else 's'), '']
        L += ['**In total:** {:,} pages · {:,} practice questions · {:,} vocabulary entries.'
              .format(tot_pages, tot_q, tot_w), '']
    else:
        L += ['This folder will hold the finished %s material. Nothing has been '
              'processed yet.' % language.title(), '']

    L += ['## What do I open?', '',
          '| I want to... | Open |', '|---|---|']
    if combined:
        L += ['| Work across every book at once | `_combined/` — one sheet per data type; '
              'filter the `collection` column to narrow to one book |']
    if live:
        L += ['| Work with a single book | that book\'s folder below — its three CSVs, no filtering needed |',
              '| Read a book as continuous text | the `.md` file inside that book\'s folder |',
              '| Know what a column means | `README.md` in this folder |',
              '| Know what is missing or imperfect | the **Known limitations** section of `README.md` |']
    L += ['']

    if live:
        L += ['## What is in each sheet', '',
              '- **catalog** — one row per page: what is on it and how it is classified.',
              '- **questions** — one row per practice item: the question, its options, the answer where the book prints one.',
              '- **vocabulary** — one row per word: the word, its meaning, its article and plural, its part of speech, an example where the book gives one.',
              '',
              '## The books', '',
              '| Book | Folder | Pages | Questions | Words |', '|---|---|---|---|---|']
        for b in live:
            L.append('| %s%s | `%s/` | %s | %s | %s |' % (
                b.get('title', b.get('folder', '')),
                ' *' if b.get('caveats') else '',
                b.get('folder', ''),
                b.get('pages') or '—', b.get('questions') or '—', b.get('words') or '—'))
        if any(b.get('caveats') for b in live):
            L += ['', '_* this book has known limitations — see `README.md`._']

    if provenance:
        L += ['', '## Where this came from', '',
              'Built from commit `%s`%s. Quote that when reporting anything about '
              'this data — it identifies exactly which extraction produced it.'
              % (provenance.get('commit', '?'),
                 (' (tag `%s`)' % provenance['tag']) if provenance.get('tag') else ''), '']

    L += ['', '## Two things worth knowing', '',
          '1. **A blank answer is usually not a mistake.** Many coursebooks print their '
          'answer keys in a separate teacher\'s guide, and listening items depend on audio. '
          'Where that is the case it is stated per book in `README.md`.',
          '2. **Gaps are disclosed, never silently dropped.** Anything that could not be '
          'read from the source is listed in **Known limitations** with the reason.',
          '3. **A blank cell usually means the book prints nothing there.** The `translation` '
          'column is filled only for bilingual books that print a meaning next to each word; '
          'a monolingual book leaves it blank throughout. The same goes for `plural` and '
          "`example`. Nothing is translated or invented on the book's behalf.", '',
          '_Generated by `%s` — re-run to refresh, do not hand-edit._' % generator, '']
    return '\n'.join(L)


# --- shared page/record helpers ------------------------------------------
# These lived duplicated in _engine/build_exports.py AND
# german/extracted/_tools/catalog.py (plus _flat in questions.py). Keeping two
# copies cost real money on 2026-08-10 alone: the HTML-comment fix, the &nbsp;
# fix, the truncation-strip fix and word_count all had to be written twice, and
# the &nbsp; one was MISSED on the German side until verify_exports.py caught it
# in already-published data. One definition each, from here on.

def split_frontmatter(txt):
    """Split a page .md into its YAML-ish frontmatter dict and its body."""
    fm, body = {}, txt
    m = re.match(r'^---\n(.*?)\n---\n?', txt, re.S)
    if m:
        for ln in m.group(1).splitlines():
            if ':' in ln:
                k, v = ln.split(':', 1)
                fm[k.strip()] = v.strip()
        body = txt[m.end():]
    return fm, body


def flat(v):
    """Collapse newlines/tabs so a value stays a single clean spreadsheet cell.

    A real None is passed straight through as '' rather than becoming the
    literal string "None" -- csv.DictWriter already handles None correctly, and
    stringifying it first defeats that (P1-2).
    """
    if v is None:
        return ''
    return ' '.join(str(v).split())


# Han, Hiragana, Katakana, Hangul: scripts that do not separate words with
# spaces. Counting whitespace-delimited tokens in Japanese reports roughly one
# "word" per LINE, which would make a Japanese book look almost empty next to a
# French one in the same catalog column.
CJK_RE = re.compile(r'[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]')


def word_count(body):
    """Words for space-separated scripts, characters for CJK, each part counted
    in its own convention. Language-agnostic, so a new language needs no change."""
    cjk = len(CJK_RE.findall(body))
    latin = len(re.findall(r'\S+', CJK_RE.sub(' ', body)))
    return cjk + latin


def page_title(body):
    """First real heading/line of a page, for the catalog's `title` column.

    Skips HTML comments (single- and multi-line), bare page-number footers and
    markup entities, any of which would otherwise become the page's "title" --
    a transcriber's `<!-- this page is blank -->` note is a comment ABOUT the
    page, not its heading. 16 French rows shipped titled with comment text, and
    a German one read "Arbeitsalltag &nbsp; 7", before this was unified.
    """
    in_comment = False
    for ln in body.splitlines():
        s = ln.strip()
        if in_comment:
            if '-->' in s:
                in_comment = False
            continue
        if not s:
            continue
        if s.startswith('<!--'):
            if '-->' not in s:
                in_comment = True
            continue
        s = re.sub(r'<!--.*?-->', ' ', s)
        s = re.sub(r'^#+\s*', '', s)
        s = re.sub(r'[*_`>|\[\]]', '', s)
        s = re.sub(r'&(nbsp|#160|thinsp|ensp|emsp);', ' ', s)
        s = ' '.join(s.split())
        if not s or re.match(r'^(page|seite|p)\s*\.?\s*\d+$', s, re.I) or re.match(r'^\d+$', s):
            continue
        # Strip again after truncating: cutting at 90 chars can land mid-gap.
        return s[:90].strip()
    return ''


def human_title(c, sep=' - '):
    """Display title for a collection, from collections.json or derived."""
    if c.get('title'):
        return c['title']
    variant = (c.get('variant') or '').replace('-', ' ').title()
    doc = os.path.splitext(os.path.basename(c.get('pdf', c['slug'])))[0].replace('-', ' ').title()
    return sep.join([c.get('level', ''), variant, doc])


def read_pages(root, slug):
    """Yield (unit, frontmatter, body) for every transcribed page of a book."""
    for md in sorted(glob.glob(os.path.join(root, slug, 'pages', 'page-*.md'))):
        unit = 'page-' + os.path.basename(md)[5:8]
        with open(md, encoding='utf-8') as f:
            fm, body = split_frontmatter(f.read())
        yield unit, fm, body.strip()


def load_classification(root, slug):
    """{page_number: classification record} from a book's _class.json."""
    path = os.path.join(root, slug, 'pages', '_class.json')
    cmap = {}
    if os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as f:
                for it in json.load(f).get('items', []):
                    cmap[int(it['page'])] = it
        except Exception:
            pass
    return cmap


def git_provenance(cwd=None):
    """{'commit': short sha, 'tag': nearest tag} for the deliverable, or None.

    Closes gap W4: uploads used to carry no record of which extraction produced
    them, so "which commit is live on Drive?" relied on memory. Stamping it into
    START-HERE.md makes the deliverable self-identifying. Returns None outside a
    git checkout rather than failing a build over provenance.
    """
    import subprocess
    def run(args):
        try:
            r = subprocess.run(args, capture_output=True, cwd=cwd, timeout=10)
            return r.stdout.decode('utf-8', 'replace').strip() if r.returncode == 0 else ''
        except Exception:
            return ''
    commit = run(['git', 'rev-parse', '--short', 'HEAD'])
    if not commit:
        return None
    return {'commit': commit, 'tag': run(['git', 'describe', '--tags', '--abbrev=0'])}


GENDER_RE = re.compile(r'\((m|f|mf|m/f|m pl|f pl)\)\s*$')


def split_gender(word):
    """('automne (m)') -> ('automne (m)', 'm'). Closes gap P6.

    Books print gender as a parenthetical suffix on the headword, so it arrived
    as punctuation inside `word` and could not be filtered or sorted on -- 403
    French entries carry one. Derived at export time rather than rewritten into
    the source: the headword must stay exactly as the book prints it, and a
    derived column can be recomputed if the rule changes.

    Returns (word_unchanged, gender_or_empty). Plural markers keep their number
    ('m pl'), since that is what the book actually asserts.
    """
    if not word:
        return word, ''
    m = GENDER_RE.search(word)
    return word, (m.group(1) if m else '')


# Columns whose emptiness is a property of the BOOK, not a defect, so an
# unexplained blank reads as missing data to whoever opens the sheet.
SPARSE_CANDIDATES = ('translation', 'gender', 'plural', 'example', 'article')


def sparse_note(rows, columns=SPARSE_CANDIDATES, threshold=10.0):
    """Which of `columns` are empty or near-empty in `rows`? Closes gap P7.

    Books differ in what they print: Cosmopolite prints no gloss at all, one
    Tricolore glossary prints no examples, several German books print no
    plurals. Those columns arrive blank and an SME cannot tell "the book does
    not print this" from "the extraction missed it".

    Computed from the shipped rows rather than hand-maintained, so it can never
    drift from what is actually in the file. Returns a list of human-readable
    strings, empty when nothing is sparse.
    """
    if not rows:
        return []
    n = len(rows)
    out = []
    for col in columns:
        if col not in rows[0]:
            continue
        filled = sum(1 for r in rows if (r.get(col) or '').strip())
        pct = 100.0 * filled / n
        if filled == 0:
            out.append('`%s` is empty throughout — this book prints none' % col)
        elif pct < threshold:
            out.append('`%s` is filled for only %.0f%% of entries — the book prints it rarely'
                       % (col, pct))
    return out
