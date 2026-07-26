#!/usr/bin/env python
"""Verify + normalize correct_answer alignment against its item_type, per
collection. A standing pipeline layer — not a one-off check: run this after
merge_enrich.py, before build_exports.py, on every book from now on.

Two different things happen here, deliberately not conflated:
1. AUTO-FIX (safe, deterministic, zero judgment): a multiple-choice item
   whose correct_answer is a bare letter ("a"/"b."/"C") gets rewritten to
   the full text of that lettered option, IF that option exists and is
   non-blank. This is a pure lookup, never a guess.
2. REPORT ONLY (needs a human/agent repair pass, same discipline as
   reconcile.py's qa:fail list): anything that requires reading the source
   page to resolve correctly --
   - a lettered MC answer whose referenced option is missing/blank,
   - a multiple-choice correct_answer that isn't among its own options at
     all (may mean a 4th+ printed option didn't fit the 3-slot schema, or a
     multi-select item -- either way, needs a human read, not a guess),
   - inconsistent "(open-ended...)" formatting across writing-task /
     speaking-task / open-ended items (bare "(open-ended)" is the baseline;
     anything else is flagged so a repair pass can normalize or confirm it),
   - INFERRED-LEVEL enforcement: for a collection with
     "level_mode": "inferred" (a book that mixes CEFR levels, e.g. Tricolore
     1's A1/A2), every question item MUST carry a per-item `level` drawn from
     that book's `level_options`. This check flags items with no `level` tag
     or a `level` outside the allowed set -- aggregated to a count + a page
     sample so a whole untagged book doesn't flood the output one line per
     item. A `fixed`-level book (whole book one level) is not expected to
     carry per-item levels and is not checked here. This is the code-level
     enforcement of the inferred-mode contract that was previously only
     described in the agent playbooks; it never guesses a level, only
     reports what a repair pass must re-tag.

Rewrites go straight to pages/_questions.json via atomic_write_text (the
merged file build_exports.py reads) -- re-run build_exports.py afterward to
refresh the CSVs. The inferred-level check is report-only and writes nothing.

Usage:
    python _engine/verify_answers.py --root french/extracted --all
    python _engine/verify_answers.py --root french/extracted <slug> [<slug> ...]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, load_collection_list, atomic_write_text

LETTER_RE = re.compile(r'^[a-dA-D]\.?$')
OPEN_ENDED_TYPES = {'writing-task', 'speaking-task', 'open-ended'}
VALID_ITEM_TYPES = {'multiple-choice', 'matching', 'true-false', 'fill-in', 'ordering',
                     'short-answer', 'writing-task', 'speaking-task', 'open-ended'}


def _letter_option(item, letter):
    return item.get('option_' + letter.lower().rstrip('.'), '')


def verify_collection(root, c):
    # `c` is a collection dict from collections.json; a bare slug string is
    # also accepted (treated as a fixed-level collection) for back-compat.
    if isinstance(c, str):
        c = {'slug': c}
    slug = c['slug']
    level_mode = c.get('level_mode', 'fixed')
    level_options = set(c.get('level_options', []))

    path = os.path.join(root, slug, 'pages', '_questions.json')
    if not os.path.exists(path):
        print('%-32s no _questions.json yet, skipped' % slug)
        return
    data = json.load(open(path, encoding='utf-8'))
    items = data.get('items', [])

    fixed = 0
    issues = []
    level_missing, level_invalid = [], []
    for it in items:
        if it.get('item_type') not in VALID_ITEM_TYPES:
            issues.append('%s/%s: item_type "%s" is not a valid item_type (looks like an '
                          'activity_type value leaked in) - reclassify by hand'
                          % (it.get('source_page'), it.get('item'), it.get('item_type')))

        # Inferred-level enforcement: every item must carry a level from the
        # book's level_options. Collected here, summarized after the loop so a
        # fully-untagged book doesn't emit hundreds of lines.
        if level_mode == 'inferred':
            lvl = (it.get('level') or '').strip()
            if not lvl:
                level_missing.append(it.get('source_page'))
            elif level_options and lvl not in level_options:
                level_invalid.append((it.get('source_page'), lvl))

        ans = (it.get('correct_answer') or '').strip()
        if not ans:
            continue

        if it.get('item_type') == 'true-false':
            if ans in ('vrai', 'faux'):
                # `ans` IS the whole answer already (the `in` check above only
                # matches when the stripped value is exactly "vrai"/"faux",
                # nothing trails it) -- use it directly rather than slicing
                # the ORIGINAL unstripped string by the STRIPPED string's
                # length, which corrupts the result whenever correct_answer
                # had leading whitespace (" vrai" -> wrongly became "Vraii").
                it['correct_answer'] = ans.capitalize()
                fixed += 1
            elif not re.match(r'^(Vrai|Faux)(\s|$)', it['correct_answer']):
                issues.append('%s/%s: true-false correct_answer "%s" doesn\'t start with Vrai/Faux - '
                              'likely mistyped as true-false (looks like category-sorting), check item_type'
                              % (it.get('source_page'), it.get('item'), ans[:50]))

        if it.get('item_type') == 'multiple-choice':
            if LETTER_RE.match(ans):
                opt = _letter_option(it, ans)
                if opt:
                    it['correct_answer'] = opt
                    fixed += 1
                else:
                    issues.append('%s/%s: correct_answer "%s" references a missing/blank option'
                                   % (it.get('source_page'), it.get('item'), ans))
            elif ans != '(open-ended)':
                opts = {it.get('option_a', ''), it.get('option_b', ''), it.get('option_c', '')}
                opts.discard('')
                if opts and not any(o in ans or ans in o for o in opts) and ans not in opts:
                    issues.append('%s/%s: correct_answer "%s" not found among its own options - '
                                  'check for a truncated 4th+ printed option'
                                  % (it.get('source_page'), it.get('item'), ans[:60]))

        if it.get('item_type') in OPEN_ENDED_TYPES and ans != '(open-ended)' and 'open-ended' in ans.lower():
            if not ans.startswith('(open-ended:'):
                issues.append('%s/%s: non-standard open-ended format "%s" (standard is "(open-ended: ...)")'
                               % (it.get('source_page'), it.get('item'), ans[:60]))

    if level_mode == 'inferred':
        if level_missing:
            pages = sorted(set(p for p in level_missing if p is not None))
            issues.append('inferred-level book: %d item(s) across %d page(s) have NO `level` tag '
                          '(e.g. pages %s) - each exercise must be tagged from %s'
                          % (len(level_missing), len(pages), pages[:8], sorted(level_options)))
        if level_invalid:
            bad = sorted(set(level_invalid))
            issues.append('inferred-level book: %d item(s) carry a `level` outside level_options %s '
                          '(e.g. %s)' % (len(level_invalid), sorted(level_options), bad[:8]))

    if fixed:
        atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=1))

    tag = 'CLEAN' if not issues else 'NEEDS REPAIR PASS'
    print('%-32s %4d items | %d auto-fixed | %d flagged for review -> %s'
          % (slug, len(items), fixed, len(issues), tag))
    for i in issues:
        print('    !', i)


def main(argv):
    root = parse_root(argv)
    cols = load_collection_list(root)
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug from collections.json.')
        return
    for c in targets:
        if c.get('frozen'):
            print('%-32s frozen - skipped' % c['slug'])
            continue
        verify_collection(root, c)


if __name__ == '__main__':
    main(sys.argv[1:])
