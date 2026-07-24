#!/usr/bin/env python
"""P1-2: _flat(None) used to turn a JSON null into the literal string "None"
in deliverable CSVs (csv.DictWriter already handles a real Python None
correctly on its own; wrapping it in ' '.join(str(v).split()) first defeated
that). Fixed with an explicit None check.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from build_exports import _flat


class FlatNoneTests(unittest.TestCase):
    def test_none_becomes_empty_string_not_the_word_none(self):
        self.assertEqual(_flat(None), '')

    def test_normal_string_unaffected(self):
        self.assertEqual(_flat('hello world'), 'hello world')

    def test_collapses_internal_whitespace(self):
        self.assertEqual(_flat('line one\nline\ttwo'), 'line one line two')

    def test_empty_string_stays_empty(self):
        self.assertEqual(_flat(''), '')


if __name__ == '__main__':
    unittest.main()
