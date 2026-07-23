#!/usr/bin/env python
"""Completeness sweep — the one check that must pass before calling a
collection "100% done." Generalizes the manual audit that caught a real
incident during the German run: an enrichment agent died silently and a
whole page range's questions never made it into the merged file. That was
only caught because someone happened to run a one-off check by hand. This
script is that check, made a standing, always-available command instead of
a habit.

Not a background job / scheduler — there isn't one in this environment.
"Automatic" means: run this as a MANDATORY step (not an optional afterthought)
at the end of a transcription wave and again before packaging/export, and
treat a non-zero exit code as a hard stop, not a warning to shrug off.

Checks two things per (non-frozen) collection, both against disk truth —
never against what an agent claimed to have done:

  1. TRANSCRIPTION completeness — for every expected page: does
     pages/page-NNN.md exist AND pages/_qa/page-NNN.json exist, parse, and
     read {"ok": true, "missing_count": 0}? Anything else is a gap.
  2. CLASSIFICATION coverage — if pages/_class.json exists at all (i.e.
     enrichment has started for this collection), does it have an entry for
     EVERY verified page? Classification is designed to be exactly 1:1 with
     pages (agent_enrich.md: "exactly one item per page in the range"), so
     any hole here is the generic, always-reliable signal that an enrichment
     batch silently vanished — exactly the failure mode that slipped through
     on the German run. (Question/vocabulary counts are printed for
     visibility but NOT gap-checked — legitimately zero items on many pages
     is normal and book-specific, unlike classification's fixed 1:1 rule.)

Usage:
    python _engine/reconcile.py --root french/extracted --all
    python _engine/reconcile.py --root french/extracted <slug> [<slug> ...]

Exit code: 0 if every checked collection is fully clean, 1 if any gap was
found (printed in full either way — this is a report-and-gate tool, not a
silent pass/fail).
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, load_collection_list


def _expected_page_count(root, slug):
    """Best available source of truth for how many pages this collection has."""
    imgs = glob.glob(os.path.join(root, slug, 'images', 'page-*.png'))
    if imgs:
        return len(imgs)
    return 0


def _qa_ok(path):
    try:
        v = json.load(open(path, encoding='utf-8'))
    except Exception:
        return False
    return bool(v.get('ok')) and not v.get('missing_count')


def check_transcription(root, slug, n):
    missing_md, missing_qa, qa_fail = [], [], []
    for p in range(1, n + 1):
        md = os.path.join(root, slug, 'pages', 'page-%03d.md' % p)
        qa = os.path.join(root, slug, 'pages', '_qa', 'page-%03d.json' % p)
        if not os.path.exists(md):
            missing_md.append(p)
            continue
        if not os.path.exists(qa):
            missing_qa.append(p)
            continue
        if not _qa_ok(qa):
            qa_fail.append(p)
    return missing_md, missing_qa, qa_fail


def check_classification(root, slug, n):
    """Returns (started, missing_pages). started=False means no _class.json
    yet — not a failure, just "enrichment hasn't run here." """
    path = os.path.join(root, slug, 'pages', '_class.json')
    if not os.path.exists(path):
        return False, []
    try:
        items = json.load(open(path, encoding='utf-8')).get('items', [])
    except Exception:
        return True, list(range(1, n + 1))  # unparseable = treat as fully missing
    have = {int(it.get('page', 0)) for it in items}
    missing = [p for p in range(1, n + 1) if p not in have]
    return True, missing


def _info_counts(root, slug):
    q_path = os.path.join(root, slug, 'pages', '_questions.json')
    q_count = 0
    if os.path.exists(q_path):
        try:
            q_count = len(json.load(open(q_path, encoding='utf-8')).get('items', []))
        except Exception:
            q_count = -1  # unparseable
    v_count = 0
    for vp in glob.glob(os.path.join(root, slug, 'pages', '_vocab', 'chunk-*.json')):
        try:
            v_count += len(json.load(open(vp, encoding='utf-8')).get('entries', []))
        except Exception:
            pass
    return q_count, v_count


def main(argv):
    root = parse_root(argv)
    cols = load_collection_list(root)
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug from collections.json.')
        return 2

    any_gap = False
    for c in targets:
        slug = c['slug']
        if c.get('frozen'):
            print('%-32s frozen - read-only, skipped' % slug)
            continue
        n = _expected_page_count(root, slug)
        if n == 0:
            print('%-32s no images found yet - nothing to check' % slug)
            continue

        missing_md, missing_qa, qa_fail = check_transcription(root, slug, n)
        transcription_gaps = missing_md + missing_qa + qa_fail
        started, class_missing = check_classification(root, slug, n)
        q_count, v_count = _info_counts(root, slug)

        clean = not transcription_gaps and not class_missing
        print('%-32s %3d pages | %s' % (slug, n, 'CLEAN' if clean else 'GAPS FOUND'))
        if missing_md:
            print('  missing page-NNN.md      (%d): %s' % (len(missing_md), missing_md))
        if missing_qa:
            print('  missing _qa/page-NNN.json (%d): %s' % (len(missing_qa), missing_qa))
        if qa_fail:
            print('  qa verdict not ok         (%d): %s' % (len(qa_fail), qa_fail))
        if not started:
            print('  classification: not started yet (informational, not a gap)')
        elif class_missing:
            print('  classification MISSING for pages (%d): %s' % (len(class_missing), class_missing))
        else:
            print('  classification: covers all %d pages' % n)
        print('  questions: %d items | vocabulary: %d entries (informational, not gap-checked)'
              % (q_count, v_count))

        if not clean:
            any_gap = True

    print()
    print('RESULT: %s' % ('GAPS FOUND - do not declare done / do not package yet' if any_gap
                           else 'all checked collections are clean'))
    return 1 if any_gap else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
