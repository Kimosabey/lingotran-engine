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
import json
import os
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


def atomic_write_text(path, text, encoding='utf-8'):
    """Convenience wrapper of atomic_open for the common "write one string" case."""
    with atomic_open(path, 'w', encoding=encoding) as f:
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


def build_start_here(language, books, combined=None, generator='package_exports.py'):
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
              '- **vocabulary** — one row per word: the word, its article and plural, its part of speech, an example where the book gives one.',
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

    L += ['', '## Two things worth knowing', '',
          '1. **A blank answer is usually not a mistake.** Many coursebooks print their '
          'answer keys in a separate teacher\'s guide, and listening items depend on audio. '
          'Where that is the case it is stated per book in `README.md`.',
          '2. **Gaps are disclosed, never silently dropped.** Anything that could not be '
          'read from the source is listed in **Known limitations** with the reason.', '',
          '_Generated by `%s` — re-run to refresh, do not hand-edit._' % generator, '']
    return '\n'.join(L)
