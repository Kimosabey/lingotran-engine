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
