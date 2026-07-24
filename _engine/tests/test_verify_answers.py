#!/usr/bin/env python
"""IT2-P1-2: the true-false auto-fix sliced the ORIGINAL unstripped
correct_answer string by the length of the STRIPPED `ans` variable, so any
leading whitespace corrupted the result (" vrai" -> "Vraii"). Fixed to just
`ans.capitalize()`, since the guard condition already guarantees `ans` IS
the whole intended value.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from verify_answers import verify_collection


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
        verify_collection(self.tmpdir, self.slug)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai')

    def test_leading_whitespace_no_longer_corrupts_faux(self):
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': '  faux'},
        ])
        verify_collection(self.tmpdir, self.slug)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Faux')

    def test_clean_value_still_fixed_normally(self):
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': 'vrai'},
        ])
        verify_collection(self.tmpdir, self.slug)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai')

    def test_already_capitalized_is_left_alone(self):
        """Already "Vrai"/"Faux" doesn't match the ans-in-('vrai','faux')
        guard (case-sensitive), so it must pass through untouched rather
        than being miscounted as fixed."""
        path = self._write_items([
            {'source_page': 1, 'item': 'a', 'item_type': 'true-false', 'correct_answer': 'Vrai'},
        ])
        verify_collection(self.tmpdir, self.slug)
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(data['items'][0]['correct_answer'], 'Vrai')


if __name__ == '__main__':
    unittest.main()
