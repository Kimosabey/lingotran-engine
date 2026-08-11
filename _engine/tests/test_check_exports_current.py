#!/usr/bin/env python
"""Fixture tests for the staleness gate's comparison, each mapping to one real
incident rather than a coverage mandate.

Eleven consecutive CI runs failed with every French CSV marked STALE while the
same command passed on Windows. The cause was CRLF (what csv.DictWriter emits)
against LF (what a Linux checkout produced). The first attempt at the date fix
compared line-by-line via splitlines(), which discards line endings -- CI went
green without the defect being touched or understood.

So the contract has two halves and both need holding: the volatile date is
ignored, and NOTHING else is, line endings very much included.

Usage: python -m unittest discover -s _engine/tests -v
"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from check_exports_current import _differs

HEADER = b'# Book\n\n> Generated %s. Filterable sheet: `book-catalog.csv`.\n\n## Overview\n'


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _write(self, name, data):
        path = os.path.join(self.tmpdir, name)
        with open(path, 'wb') as f:
            f.write(data)
        return path

    def test_identical_files_do_not_differ(self):
        a = self._write('a.md', HEADER % b'2026-08-11')
        b = self._write('b.md', HEADER % b'2026-08-11')
        self.assertFalse(_differs(a, b))

    def test_generated_date_is_ignored(self):
        """The UTC/+0530 boundary is crossed daily; this must not cry wolf."""
        a = self._write('a.md', HEADER % b'2026-08-11')
        b = self._write('b.md', HEADER % b'2026-08-10')
        self.assertFalse(_differs(a, b))

    def test_line_endings_are_not_ignored(self):
        """The regression that mattered: CRLF vs LF is a real difference.

        splitlines() would call these equal and hand CI a false green.
        """
        a = self._write('a.csv', b'col_a,col_b\r\n1,2\r\n')
        b = self._write('b.csv', b'col_a,col_b\n1,2\n')
        self.assertTrue(_differs(a, b))

    def test_rest_of_the_generated_line_is_not_ignored(self):
        """Only the date token is neutralised -- the catalog filename on that
        same line is content, and a rename must still register."""
        a = self._write('a.md', HEADER % b'2026-08-11')
        b = self._write('b.md', (HEADER % b'2026-08-11').replace(
            b'book-catalog.csv', b'book-catalogue.csv'))
        self.assertTrue(_differs(a, b))

    def test_content_change_is_detected(self):
        a = self._write('a.csv', b'col_a,col_b\r\n1,2\r\n')
        b = self._write('b.csv', b'col_a,col_b\r\n1,3\r\n')
        self.assertTrue(_differs(a, b))

    def test_trailing_newline_is_not_ignored(self):
        a = self._write('a.csv', b'col_a\r\n1\r\n')
        b = self._write('b.csv', b'col_a\r\n1')
        self.assertTrue(_differs(a, b))


if __name__ == '__main__':
    unittest.main()
