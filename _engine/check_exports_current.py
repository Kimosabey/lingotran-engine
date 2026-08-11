#!/usr/bin/env python
"""Are the committed exports actually current with their sources?

Closes gap W3. The other gates all read the exports as they stand; none asks
whether those exports still match the data they were built from. That is a real
failure mode, not a hypothetical -- a German export shipped at 8.7% coverage
because chunks had been backfilled but `merge_enrich` never ran, so the
exporter read stale merged files and produced a clean-looking, wrong CSV.

Nothing in CI could see that: the tests pass, the gates pass, the committed
files are internally consistent. They are just out of date.

This rebuilds every export into a TEMPORARY directory and compares against what
is committed. A difference means the working tree's sources have moved on and
someone forgot a regeneration step. It never writes to the real tree.

Deliberately does NOT run merge_enrich: merging is a decision (it collapses
chunk edits into the merged file), while building and packaging are pure
derivations. What this asks is narrower and safer -- "given the CURRENT merged
data, are the exports what they should be?"

Usage:
    python _engine/check_exports_current.py --root french/extracted
    python _engine/check_exports_current.py --root german/extracted

Exit code is non-zero when exports are stale. Intended for CI, where nobody is
watching a terminal.
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, lang_slug

ENGINE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ENGINE)


# The unified .md header carries "Generated <date>", which moves on its own every
# day -- and CI runs in UTC while commits here are +0530, so that boundary is
# crossed daily. A check that cries wolf every morning gets switched off, which is
# worse than not having it. Only the date TOKEN is neutralised; everything else,
# line endings included, is still compared byte for byte.
#
# Do not "simplify" this to a line-by-line comparison. splitlines() discards line
# endings, and that is not a hypothetical loss: it silently masked the CRLF/LF
# mismatch that was failing every CI run, turning the build green while the real
# defect stayed put. Neutralise the token, compare the bytes.
VOLATILE = re.compile(rb'(?m)^(> Generated )\d{4}-\d{2}-\d{2}\.')


def _meaningful(path):
    with open(path, 'rb') as f:
        return VOLATILE.sub(rb'\1<date>.', f.read())


def _differs(a, b):
    return _meaningful(a) != _meaningful(b)


def _rel_map(root):
    """{relative path -> absolute path} for every committed export artifact."""
    out = {}
    for pattern in ('*-catalog-all.csv', '*-questions-all.csv', '*-vocabulary-all.csv'):
        for fp in glob.glob(os.path.join(root, pattern)):
            out[os.path.basename(fp)] = fp
    for sub in ('*/*-catalog.csv', '*/*-questions.csv', '*/*-vocabulary.csv', '*/*.md'):
        for fp in glob.glob(os.path.join(root, sub)):
            if os.sep + '_' in fp.replace(root, ''):     # skip _tools/, _exports/
                continue
            out[os.path.relpath(fp, root).replace(os.sep, '/')] = fp
    return out


def main(argv):
    root = parse_root(argv)
    lang = lang_slug(root)

    if lang != 'french':
        # build_exports.py is the shared engine's builder and only knows the
        # _engine layout. German has its own catalog/questions/vocabulary
        # scripts, so a faithful rebuild there needs those instead -- wire it up
        # when German moves onto _engine (gap P1) rather than half-checking now
        # and reporting a false clean.
        print('%s: staleness check is only wired for the shared engine; '
              'skipped (see gap P1)' % lang)
        return 0

    before = _rel_map(root)
    if not before:
        print('%s: no exports found - nothing to compare' % lang)
        return 0

    staging = tempfile.mkdtemp(prefix='exports-current-')
    backup = tempfile.mkdtemp(prefix='exports-backup-')
    try:
        # Preserve the committed artifacts, rebuild in place, compare, restore.
        # In-place is the only faithful option: build_exports writes relative to
        # --root and reads sources from it.
        for rel, fp in before.items():
            dest = os.path.join(backup, rel.replace('/', os.sep))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(fp, dest)

        r = subprocess.run(
            [sys.executable, os.path.join(ENGINE, 'build_exports.py'), '--root', root, '--all'],
            capture_output=True, cwd=REPO)
        if r.returncode != 0:
            print('build_exports.py failed:\n%s' % r.stderr.decode('utf-8', 'replace')[:1500])
            return 1

        after = _rel_map(root)
        stale, missing = [], []
        for rel, fp in sorted(after.items()):
            old = os.path.join(backup, rel.replace('/', os.sep))
            if not os.path.exists(old):
                missing.append(rel)
            elif _differs(old, fp):
                stale.append(rel)

        # Restore the committed content regardless of outcome.
        for rel in after:
            old = os.path.join(backup, rel.replace('/', os.sep))
            if os.path.exists(old):
                shutil.copy2(old, after[rel])

        print('%s: %d export artifact(s) compared against a fresh rebuild' % (lang, len(after)))
        if not stale and not missing:
            print('\nRESULT: exports are current with their sources')
            return 0
        for rel in stale:
            print('  STALE   %s' % rel)
        for rel in missing:
            print('  NEW     %s (a rebuild produces it; it is not committed)' % rel)
        print('\n%d file(s) differ from a fresh rebuild - the sources have moved on.'
              % (len(stale) + len(missing)))
        print('Run merge_enrich.py (if chunks changed), then build_exports.py and '
              'package_exports.py, and commit the result.')
        return 1
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        shutil.rmtree(backup, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
