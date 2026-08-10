#!/usr/bin/env python
"""IT2-P1-2: the true-false auto-fix sliced the ORIGINAL unstripped
correct_answer string by the length of the STRIPPED `ans` variable, so any
leading whitespace corrupted the result (" vrai" -> "Vraii"). Fixed to just
`ans.capitalize()`, since the guard condition already guarantees `ans` IS
the whole intended value.
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from verify_answers import verify_collection, DEFAULT_TF_TERMS

# These assertions are French-specific (vrai/faux). The tests run from a temp
# directory, so the language cannot be derived from the path -- declare it,
# the same way a real collections.json would.
FR = {'true_false_terms': DEFAULT_TF_TERMS['french']}


class TrueFalseWhitespaceTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.slug = 'test-collection'
        self.pages_dir = os.path.join(self.tmpdir, self.slug, 'pages')
        os.makedirs(self.pages_dir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _write_items(self, items):
        path = os.path.join(self.pages_dir, '_questions.json')
        json.dump({'items': items}, open(path, 'w', encoding='utf-8'))
        return path

    def test_leading_whitespace_no_longer_corrupts_vrai(self):
        """The exact reported bug: " vrai" must become "Vrai", not "Vraii"."""
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': ' vrai'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai')

    def test_leading_whitespace_no_longer_corrupts_faux(self):
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': '  faux'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Faux')

    def test_clean_value_still_fixed_normally(self):
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': 'vrai'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai')

    def test_already_capitalized_is_left_alone(self):
        """Already "Vrai"/"Faux" doesn't match the ans-in-('vrai','faux')
        guard (case-sensitive), so it must pass through untouched rather
        than being miscounted as fixed."""
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': 'Vrai'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai')

    def test_leading_faux_with_trailing_correction_is_capitalized_in_place(self):
        """A genuinely valid true-false pattern found on Tricolore 1: "faux --
        <the actual correct statement>" (item is false; the real answer is
        given as a correction). Only the leading word's case is wrong --
        capitalize just that word, leave the correction text byte-for-byte
        untouched (this is the exact field a slice-based fix already
        corrupted once -- see IT2-P1-2 -- so this must use a targeted
        substitution, not a slice-and-concatenate)."""
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false',
             'correct_answer': 'faux — Seule Jojo mange le fromage.'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Faux — Seule Jojo mange le fromage.')

    def test_leading_vrai_with_trailing_parenthetical_is_capitalized_in_place(self):
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false',
             'correct_answer': 'vrai (elle a sept ans)'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai (elle a sept ans)')

    def test_leading_faux_with_period_separator_is_capitalized_in_place(self):
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false',
             'correct_answer': "faux. C'est à Pâques."},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], "Faux. C'est à Pâques.")

    def test_leading_whitespace_before_faux_correction_is_preserved(self):
        """Combines both fixes: leading whitespace on the field AND a trailing
        correction -- the whitespace must survive, and only "faux" capitalizes."""
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false',
             'correct_answer': '  faux - not quite'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], '  Faux - not quite')

    def test_already_correct_faux_with_period_is_not_falsely_flagged(self):
        """"Faux. <explanation>" (punctuation immediately after the word, no
        space) is already correctly formatted -- the final validation check
        must accept it, not flag it as malformed just because \\s or end-of-
        string doesn't immediately follow the word."""
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            path = self._write_items([
                {'source_page': 1, 'item': 'a', 'item_type': 'true-false',
                 'correct_answer': "Faux. C'est à Pâques."},
            ])
            verify_collection(self.tmpdir, self.slug, FR)
        self.assertNotIn('!', buf.getvalue())
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], "Faux. C'est à Pâques.")

    def test_unrelated_word_starting_with_faux_is_not_falsely_matched(self):
        """"fauxx" or "fauxbourg"-style words must not be treated as a
        true/false answer just because they start with the substring "faux"
        -- the \\b word-boundary guard must reject this."""
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false',
             'correct_answer': 'fauxword unrelated'},
        ])
        verify_collection(self.tmpdir, self.slug, FR)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'fauxword unrelated')


class InferredLevelTests(unittest.TestCase):
    """The inferred-mode enforcement: an `inferred` book must carry a per-item
    `level` from its `level_options`; a `fixed` book is not checked. Report
    only — never mutates, never guesses a level."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.slug = 'test-collection'
        self.pages_dir = os.path.join(self.tmpdir, self.slug, 'pages')
        os.makedirs(self.pages_dir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _run(self, items, config):
        json.dump({'items': items},
                  open(os.path.join(self.pages_dir, '_questions.json'), 'w', encoding='utf-8'))
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            verify_collection(self.tmpdir, config)
        return buf.getvalue()

    def _cfg(self, **extra):
        return dict({'slug': self.slug}, **extra)

    def test_inferred_all_tagged_is_clean(self):
        out = self._run(
            [{'source_page': 1, 'item': 'a', 'item_type': 'fill-in', 'level': 'A1'},
             {'source_page': 2, 'item': 'b', 'item_type': 'fill-in', 'level': 'A2'}],
            self._cfg(level_mode='inferred', level_options=['A1', 'A2']))
        self.assertIn('CLEAN', out)
        self.assertNotIn('inferred-level', out)

    def test_inferred_missing_level_is_flagged(self):
        out = self._run(
            [{'source_page': 5, 'item': 'a', 'item_type': 'fill-in', 'level': 'A1'},
             {'source_page': 7, 'item': 'b', 'item_type': 'fill-in'}],  # no level
            self._cfg(level_mode='inferred', level_options=['A1', 'A2']))
        self.assertIn('NEEDS REPAIR PASS', out)
        self.assertIn('NO `level` tag', out)
        self.assertIn('7', out)  # the offending page is surfaced

    def test_inferred_out_of_range_level_is_flagged(self):
        out = self._run(
            [{'source_page': 3, 'item': 'a', 'item_type': 'fill-in', 'level': 'B2'}],  # not in options
            self._cfg(level_mode='inferred', level_options=['A1', 'A2']))
        self.assertIn('outside level_options', out)

    def test_fixed_book_is_not_level_checked(self):
        """A fixed-level book carries no per-item level and must NOT be flagged
        for it — the check only applies to inferred books."""
        out = self._run(
            [{'source_page': 1, 'item': 'a', 'item_type': 'fill-in'}],  # no level, but fixed
            self._cfg(level_mode='fixed'))
        self.assertIn('CLEAN', out)
        self.assertNotIn('inferred-level', out)

    def test_many_untagged_items_are_aggregated_not_flooded(self):
        """A whole untagged book must produce ONE summary line, not one per
        item — the anti-flood behaviour."""
        items = [{'source_page': p, 'item': 'a', 'item_type': 'fill-in'} for p in range(1, 51)]
        out = self._run(items, self._cfg(level_mode='inferred', level_options=['A1', 'A2']))
        # exactly one flagged line mentioning the missing-level summary
        flagged = [ln for ln in out.splitlines() if 'NO `level` tag' in ln]
        self.assertEqual(len(flagged), 1)
        self.assertIn('50 item(s)', flagged[0])


if __name__ == '__main__':
    unittest.main()


class LanguageAgnosticTrueFalseTests(unittest.TestCase):
    """The true/false vocabulary is a per-LANGUAGE fact, not a constant.

    It was hardcoded French until 2026-08-10, so pointing this gate at German
    produced 70 false "doesn't start with Vrai/Faux" flags against perfectly
    correct Richtig/Falsch answers -- and would have done the same for every
    language added afterwards.
    """

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.slug = 'test-collection'
        self.pages = os.path.join(self.tmpdir, self.slug, 'pages')
        os.makedirs(self.pages)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _run(self, answer, cfg):
        path = os.path.join(self.pages, '_questions.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'items': [{'source_page': 1, 'item': 'a',
                                  'item_type': 'true-false',
                                  'correct_answer': answer}]}, f)
        verify_collection(self.tmpdir, self.slug, cfg)
        with open(path, encoding='utf-8') as f:
            return json.load(f)['items'][0]['correct_answer']

    def test_german_richtig_falsch_are_accepted_and_normalised(self):
        de = {'true_false_terms': DEFAULT_TF_TERMS['german']}
        self.assertEqual(self._run('richtig', de), 'Richtig')
        self.assertEqual(self._run('falsch', de), 'Falsch')

    def test_french_terms_are_not_valid_for_a_german_book(self):
        de = {'true_false_terms': DEFAULT_TF_TERMS['german']}
        self.assertEqual(self._run('vrai', de), 'vrai', 'must not be silently "fixed"')

    def test_a_language_can_declare_its_own_terms(self):
        es = {'true_false_terms': {'true': ['verdadero'], 'false': ['falso'],
                                   'not_mentioned': []}}
        self.assertEqual(self._run('verdadero', es), 'Verdadero')

    def test_three_way_not_mentioned_is_legitimate_not_malformed(self):
        fr = {'true_false_terms': DEFAULT_TF_TERMS['french']}
        self.assertEqual(self._run('pas mentionné', fr), 'Pas mentionné')

    def test_unknown_language_falls_back_to_english_terms(self):
        self.assertEqual(self._run('true', {}), 'True')
