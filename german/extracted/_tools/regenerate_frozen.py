#!/usr/bin/env python
"""Regenerate frozen collections safely, then put the freeze back.

Closes gap W2. Frozen collections are skipped by every exporter, which is
correct -- already-delivered files must not be silently re-touched. But a
legitimate corpus-wide correction (an English taxonomy value, a renamed column,
a backfilled rubric) does have to reach them, and the documented procedure was
manual:

    flip every "frozen": true to false  ->  run the exporters  ->  flip back
    ->  confirm `git diff` on collections.json is empty

That was run seven times in a single day. Every run is a chance to forget the
refreeze and leave delivered corpora unprotected, or to leave a half-flipped
config behind if something dies mid-way.

This does the whole dance in one call, and restores the original config in a
`finally` block so an exception, a failing exporter or a Ctrl-C still puts the
freeze back. It verifies the restore byte-for-byte before reporting success.

Usage:
    python _tools/regenerate_frozen.py catalog questions vocabulary merge_all package_exports
    python _tools/regenerate_frozen.py --all      # the full chain, in order

Exit code is non-zero if any stage fails OR if the config could not be restored
exactly -- the second is the one that matters, because a wrong config is worse
than a missed regeneration.
"""
import os
import subprocess
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(TOOLS, 'collections.json')

# Order matters: build every sheet, then package. The four separate exporters
# (catalog/questions/vocabulary/merge_all) were German's forked copies; they are
# gone (gap P1) and _engine/build_exports.py does all four jobs in one pass,
# including the per-family tier and the global merge.
ENGINE = os.path.abspath(os.path.join(TOOLS, '..', '..', '..', '_engine'))
STAGES = {
    'build_exports': [os.path.join(ENGINE, 'build_exports.py'), '--root', os.path.dirname(TOOLS)],
    'package_exports': [os.path.join(TOOLS, 'package_exports.py')],
}
FULL_CHAIN = ['build_exports', 'package_exports']


def main(argv):
    stages = FULL_CHAIN if ('--all' in argv or not argv) else [a for a in argv if not a.startswith('-')]
    unknown = [s for s in stages if s not in STAGES]
    if unknown:
        print('No such stage(s): %s' % ', '.join(unknown))
        print('Available: %s' % ', '.join(FULL_CHAIN))
        return 2

    with open(CONFIG, encoding='utf-8') as f:
        original = f.read()
    if '"frozen": true' not in original:
        print('Nothing is frozen — run the exporters directly, no dance needed.')
        return 0

    n_frozen = original.count('"frozen": true')
    print('Unfreezing %d collection(s) for regeneration...' % n_frozen)
    failed = []
    try:
        with open(CONFIG, 'w', encoding='utf-8') as f:
            f.write(original.replace('"frozen": true', '"frozen": false'))

        for stage in stages:
            cmd = [sys.executable] + STAGES[stage]
            r = subprocess.run(cmd, capture_output=True, cwd=os.path.dirname(TOOLS))
            ok = r.returncode == 0
            print('  %-16s %s' % (stage, 'ok' if ok else 'FAILED'))
            if not ok:
                failed.append(stage)
                sys.stderr.write(r.stderr.decode('utf-8', 'replace')[:1200])
    finally:
        # Always restore, even on exception or interrupt. A wrong config left
        # behind is worse than a missed regeneration.
        with open(CONFIG, 'w', encoding='utf-8') as f:
            f.write(original)

    with open(CONFIG, encoding='utf-8') as f:
        restored = f.read()
    if restored != original:
        print('\n!! collections.json was NOT restored byte-for-byte — FIX THIS BEFORE ANYTHING ELSE')
        return 1
    print('Refroze %d collection(s); collections.json restored byte-for-byte.' % n_frozen)

    if failed:
        print('\n%d stage(s) failed: %s' % (len(failed), ', '.join(failed)))
        return 1
    print('\nRESULT: frozen collections regenerated, freeze restored')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
