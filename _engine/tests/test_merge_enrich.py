#!/usr/bin/env python
"""P1-1: merge_enrich.py used to resolve overlapping enrichment chunks by
alphabetical filename order (so a corrective re-run's chunk could lose to
the original it was meant to fix), with zero visibility when it happened.
Fixed to mtime order + last-write-wins for classification (a genuine 1:1
key), and cross-chunk-only duplicate visibility for questions (no natural
key, so this reports rather than dedupes).
"""
import json
import os
import shutil
import sys
import tempfile
import time
import unittest
from io import StringIO

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import merge_enrich


class MergePrecedenceTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.root, 'book-one', 'pages', '_class'))
        os.makedirs(os.path.join(self.root, 'book-one', 'pages', '_questions'))

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def _write_class_chunk(self, name, items):
        path = os.path.join(self.root, 'book-one', 'pages', '_class', name)
        json.dump({'collection': 'book-one', 'items': items}, open(path, 'w', encoding='utf-8'))
        time.sleep(0.05)  # ensure a distinct, later mtime for the next chunk written

    def _write_questions_chunk(self, name, items):
        path = os.path.join(self.root, 'book-one', 'pages', '_questions', name)
        json.dump({'collection': 'book-one', 'items': items}, open(path, 'w', encoding='utf-8'))
        time.sleep(0.05)

    def test_later_chunk_wins_even_if_its_filename_sorts_first(self):
        # chunk-1-50 (wrong) is written FIRST; chunk-25-50 (corrective fix,
        # alphabetically EARLIER) is written SECOND/LATER in time -- mtime
        # order must make the correction win, not the filename order.
        self._write_class_chunk('chunk-1-50.json', [{'page': 30, 'activity_type': 'WRONG'}])
        self._write_class_chunk('chunk-25-50.json', [{'page': 30, 'activity_type': 'CORRECTED'}])
        merge_enrich.merge_class(self.root, 'book-one')
        out = json.load(open(os.path.join(self.root, 'book-one', 'pages', '_class.json'), encoding='utf-8'))
        self.assertEqual(out['items'][0]['activity_type'], 'CORRECTED')

    def test_questions_cross_chunk_duplicate_is_flagged_not_silent(self):
        self._write_questions_chunk('chunk-a.json', [
            {'source_page': '005', 'part': 'Ex1', 'item': 'a', 'question': 'orig'}])
        self._write_questions_chunk('chunk-b.json', [
            {'source_page': '005', 'part': 'Ex1', 'item': 'a', 'question': 'fixed'}])
        captured = StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured
        try:
            merge_enrich.merge_questions(self.root, 'book-one')
        finally:
            sys.stdout = old_stdout
        self.assertIn('more than one DIFFERENT', captured.getvalue())
        out = json.load(open(os.path.join(self.root, 'book-one', 'pages', '_questions.json'), encoding='utf-8'))
        self.assertEqual(len(out['items']), 2, 'questions has no natural key, so both rows are kept, just flagged')

    def test_same_item_label_within_ONE_chunk_is_not_falsely_flagged(self):
        """Item labels like 'a'/'1' legitimately restart per exercise `part`
        on the same page -- this must NOT be treated as a cross-chunk repeat."""
        self._write_questions_chunk('chunk-only.json', [
            {'source_page': '010', 'part': 'Ex1', 'item': 'a', 'question': 'first exercise item a'},
            {'source_page': '010', 'part': 'Ex2', 'item': 'a', 'question': 'second exercise item a'},
        ])
        captured = StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured
        try:
            merge_enrich.merge_questions(self.root, 'book-one')
        finally:
            sys.stdout = old_stdout
        self.assertNotIn('DIFFERENT', captured.getvalue(),
                         'same-page-different-part reuse of a label is normal, must stay silent')

    def test_no_chunk_bookkeeping_leaks_into_output(self):
        self._write_questions_chunk('chunk-only.json', [
            {'source_page': '010', 'part': 'Ex1', 'item': 'a', 'question': 'q'}])
        merge_enrich.merge_questions(self.root, 'book-one')
        out = json.load(open(os.path.join(self.root, 'book-one', 'pages', '_questions.json'), encoding='utf-8'))
        self.assertNotIn('_chunk', out['items'][0])


if __name__ == '__main__':
    unittest.main()
