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
    python _engine/verify_answers.py --root french/extracted --all --strict   # non-zero exit if anything is flagged
    python _engine/verify_answers.py --root french/extracted <slug> [<slug> ...]
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, load_collections, load_collection_list, atomic_write_text

# A true/false item is answered in the BOOK's language, so the words to expect
# are a per-language fact, not a constant. They lived hardcoded as French
# vrai/faux until 2026-08-10, which meant pointing this gate at German produced
# 70 false "doesn't start with Vrai/Faux" flags against perfectly correct
# Richtig/Falsch answers -- and would have done the same for every language
# added later. Override per language in collections.json:
#
#   "true_false_terms": {"true": ["richtig"], "false": ["falsch"],
#                        "not_mentioned": ["nicht genannt"]}
#
# `not_mentioned` covers the three-way "Vrai, faux ou pas mentionné?" format,
# which is a real printed exercise type, not a malformed answer.
DEFAULT_TF_TERMS = {
    'french': {'true': ['vrai'], 'false': ['faux'],
               'not_mentioned': ['pas mentionne', 'pas mentionné', 'non mentionne',
                                 'non mentionné']},
    'german': {'true': ['richtig'], 'false': ['falsch'],
               'not_mentioned': ['nicht genannt', 'nicht im text']},
}
FALLBACK_TF_TERMS = {'true': ['true'], 'false': ['false'], 'not_mentioned': ['not mentioned']}


def tf_terms(root, cfg):
    """Resolve the true/false vocabulary for this language."""
    explicit = cfg.get('true_false_terms')
    if explicit:
        return {k: [str(v).lower() for v in explicit.get(k, [])] for k in
                ('true', 'false', 'not_mentioned')}
    lang = os.path.basename(os.path.dirname(root)).lower()
    return DEFAULT_TF_TERMS.get(lang, FALLBACK_TF_TERMS)


def _starts_with_any(text, words):
    for w in words:
        if w and re.match(r'^\s*%s\b' % re.escape(w), text, re.I):
            return w
    return None

LETTER_RE = re.compile(r'^[a-dA-D]\.?$')
OPEN_ENDED_TYPES = {'writing-task', 'speaking-task', 'open-ended'}
VALID_ITEM_TYPES = {'multiple-choice', 'matching', 'true-false', 'fill-in', 'ordering',
                     'short-answer', 'writing-task', 'speaking-task', 'open-ended'}


def _letter_option(item, letter):
    return item.get('option_' + letter.lower().rstrip('.'), '')



def _persist_fixes(root, slug, data, merged_path):
    """Write auto-fixes back to whichever file is authoritative for this book.

    Returns a short description of what was written, for the caller to print.
    """
    chunk_dir = os.path.join(root, slug, 'pages', '_questions')
    chunks = sorted(glob.glob(os.path.join(chunk_dir, 'chunk-*.json')))
    if not chunks:
        atomic_write_text(merged_path, json.dumps(data, ensure_ascii=False, indent=1))
        return '_questions.json (no chunk dir - it is the source of truth here)'

    # Index the corrected items so each chunk can be updated in place. Keyed on
    # (source_page, item, question) rather than position: merge order is stable
    # today, but a key that survives reordering is worth the few extra bytes.
    fixed_by_key = {}
    for it in data.get('items', []):
        fixed_by_key[(str(it.get('source_page')), str(it.get('item')),
                      (it.get('question') or '')[:80])] = it.get('correct_answer')

    touched = 0
    for cp in chunks:
        with open(cp, encoding='utf-8') as f:
            cdata = json.load(f)
        items = cdata.get('items', [])
        changed = False
        for it in items:
            k = (str(it.get('source_page')), str(it.get('item')),
                 (it.get('question') or '')[:80])
            if k in fixed_by_key and it.get('correct_answer') != fixed_by_key[k]:
                it['correct_answer'] = fixed_by_key[k]
                changed = True
        if changed:
            atomic_write_text(cp, json.dumps(cdata, ensure_ascii=False, indent=2))
            touched += 1
    atomic_write_text(merged_path, json.dumps(data, ensure_ascii=False, indent=1))
    return '%d chunk file(s) + _questions.json' % touched


def verify_collection(root, c, cfg=None):
    # `c` is a collection dict from collections.json; a bare slug string is
    # also accepted (treated as a fixed-level collection) for back-compat.
    if isinstance(c, str):
        c = {'slug': c}
    cfg = cfg or {}
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
            # The expected words come from the language config, not a constant.
            # Three-way "true / false / not mentioned" exercises are a real
            # printed format (Tricolore 2 p123 sets it out verbatim, with "pas
            # mentionne" as its own worked example), so a not-mentioned answer
            # is legitimate rather than a mistyped item_type.
            terms = tf_terms(root, cfg)
            allowed = terms['true'] + terms['false'] + terms['not_mentioned']
            hit = _starts_with_any(ans, allowed)
            if hit:
                if ans.lower() == hit:
                    # The answer is EXACTLY the term and nothing else, so use
                    # the stripped value directly. Never slice the ORIGINAL
                    # string by the STRIPPED string's length -- that is what
                    # turned " vrai" into "Vraii" once already; see IT2-P1-2.
                    if it['correct_answer'] != ans.capitalize():
                        it['correct_answer'] = ans.capitalize()
                        fixed += 1
                else:
                    # "faux -- <the actual correct statement>": the item is
                    # false and the real answer follows it. Only the leading
                    # word's capitalisation can be wrong, so fix that in place
                    # and leave everything else, including any leading
                    # whitespace, byte-for-byte untouched.
                    m = re.match(r'^(\s*)(%s)' % re.escape(hit), it['correct_answer'], re.I)
                    if m and not m.group(2)[:1].isupper():
                        it['correct_answer'] = (m.group(1) + m.group(2).capitalize()
                                                + it['correct_answer'][m.end():])
                        fixed += 1
            else:
                issues.append('%s/%s: true-false correct_answer "%s" does not start with any '
                              'expected term for this language (%s) - likely mistyped as '
                              'true-false, check item_type'
                              % (it.get('source_page'), it.get('item'), ans[:50],
                                 '/'.join(w.capitalize() for w in terms['true'] + terms['false'])))

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
                # Options now run a..e (gap P4). Before 2026-08-10 the schema
                # stopped at (c), so a book printing four or five silently lost
                # the rest and its answer pointed at a column that never existed.
                opts = {it.get('option_%s' % k, '') for k in 'abcde'}
                opts.discard('')
                matched = any(o in ans or ans in o for o in opts) or ans in opts
                if opts and not matched:
                    # A MULTI-SELECT answer is legitimately several options at
                    # once ("Benjamin Clementine et Grégory Privat"), so it will
                    # never equal any single one. Accept it when its parts are
                    # all real options; only flag when something is genuinely
                    # unaccounted for.
                    parts = [p.strip(' .;,') for p in
                             re.split(r'\s+(?:et|and|und|y)\s+|[;,]', ans) if p.strip(' .;,')]
                    if len(parts) > 1 and all(
                            any(p in o or o in p for o in opts) for p in parts):
                        matched = True
                if opts and not matched:
                    issues.append('%s/%s: correct_answer "%s" is not among its own options, '
                                  'and is not a multi-select of them - check whether an option '
                                  'was not captured, or the answer belongs to a different item'
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

    # Cross-check the blank-answer rate against what the book CLAIMS about its
    # own answer key. A high blank rate is entirely correct for a student
    # coursebook whose corriges live in a separate teacher's guide (Cosmopolite
    # 1 is 35%, Tricolore 2 is 58%) -- and entirely wrong for a book that
    # prints its own key, where it means the answers were there to extract and
    # were missed. Nothing compared the two before, so either reading looked
    # the same from the outside.
    ak = (c.get('answer_key') or {}).get('status')
    answerable = [it for it in items
                  if (it.get('item_type') or '') not in OPEN_ENDED_TYPES]
    if ak and answerable:
        blank = sum(1 for it in answerable if not (it.get('correct_answer') or '').strip())
        rate = 100.0 * blank / len(answerable)
        if ak == 'printed' and rate > 20:
            issues.append('answer_key.status is "printed" but %.0f%% of answerable items '
                          '(%d/%d) have a blank correct_answer - either the key was not '
                          'extracted, or the status is wrong'
                          % (rate, blank, len(answerable)))
        elif ak in ('separate-guide', 'none') and rate < 5:
            issues.append('answer_key.status is "%s" but only %.0f%% of answerable items are '
                          'blank - answers were found somewhere, so the status is likely wrong'
                          % (ak, rate))

    if fixed:
        # Persist to the SOURCE OF TRUTH, not just the merged file.
        #
        # This used to write only pages/_questions.json -- which merge_enrich.py
        # regenerates from pages/_questions/chunk-*.json. Every re-merge silently
        # reverted every auto-fix, so a `merge_enrich -> build_exports` run that
        # skipped this step shipped "vrai" instead of "Vrai" and bare-letter MC
        # answers. Measured before the fix: 52 items in tricolore-1 where the
        # chunk and the merged file disagreed. It is the same trap PLAYBOOK.md
        # already records for repair passes -- a derived file must never hold
        # state that its source does not.
        #
        # Books with no chunk directory (German's 5 Goethe exam books) keep the
        # merged file as their genuine source of truth, so it is written there.
        written = _persist_fixes(root, slug, data, path)
        print('%-32s   %d auto-fix(es) written to %s' % ('', fixed, written))

    # An individually reviewed, legitimate flag can be accepted in
    # collections.json so it stops blocking --strict while STAYING VISIBLE --
    # the same discipline as reconcile.py's accepted_qa_gaps. The real case: a
    # DELF item whose options are PHOTOGRAPHS, transcribed as descriptions, so
    # its answer ("Une carte postale (photo a)") can never match an option by
    # text. That is the item, not a defect, and no amount of re-extraction
    # changes it.
    accepted = set(c.get('accepted_answer_flags', []))
    if accepted:
        kept, waived = [], []
        for i in issues:
            key = i.split(':')[0].strip()
            (waived if key in accepted else kept).append(i)
        issues = kept
        for i in waived:
            print('    ~ accepted:', i)

    tag = 'CLEAN' if not issues else 'NEEDS REPAIR PASS'
    print('%-32s %4d items | %d auto-fixed | %d flagged for review -> %s'
          % (slug, len(items), fixed, len(issues), tag))
    for i in issues:
        print('    !', i)
    return len(issues)


def main(argv):
    root = parse_root(argv)
    cfg = load_collections(root)
    cols = cfg['collections']
    targets = cols if '--all' in argv else [c for c in cols if c['slug'] in set(argv)]
    if not targets:
        print('No matching collections. Use --all or a slug from collections.json.')
        return
    strict = '--strict' in argv
    flagged = 0
    for c in targets:
        if c.get('frozen'):
            print('%-32s frozen - skipped' % c['slug'])
            continue
        flagged += verify_collection(root, c, cfg) or 0

    if flagged and strict:
        # Gap P8: this gate printed NEEDS REPAIR PASS and still exited 0, so CI
        # could not fail on it and a flagged book could be packaged. --strict
        # makes it binding; the default stays report-only so a mid-run triage
        # pass is not blocked by known, accepted flags.
        print('')
        print('%d item(s) flagged and --strict is set - not clean' % flagged)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]) or 0)
