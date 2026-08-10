#!/usr/bin/env python
"""First tests for German's bespoke pipeline.

It holds 10 of the 13 delivered books and had no test coverage at all, while
_engine had 105 tests. Every fix made to it on 2026-08-10 -- the teil->part
rename, the &nbsp; entity decode, item_type "open"->"open-ended", dropping
header-only CSVs, and converting 14 bare writes to atomic ones -- landed with
no regression cover. These pin the behaviour that matters most: that a killed
run cannot corrupt a delivered file, and that the export schema stays put.
"""
import csv
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
sys.path.insert(0, os.path.abspath(os.path.join(TOOLS, '..', '..', '..', '_engine')))

import questions as q_mod
from _common import atomic_open


class AtomicWriteTests(unittest.TestCase):
    """German's writers were all bare open(..., 'w') until 2026-08-10, several
    of them writing already-delivered frozen deliverables during the
    unfreeze/refreeze dance. A crash mid-write truncated the only copy."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.target = os.path.join(self.tmp, 'delivered.csv')
        with io.open(self.target, 'w', encoding='utf-8') as f:
            f.write('good,original,content\n1,2,3\n')
        self.original = io.open(self.target, encoding='utf-8').read()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_a_crash_mid_write_leaves_the_previous_file_intact(self):
        with self.assertRaises(RuntimeError):
            with atomic_open(self.target, 'w', encoding='utf-8') as f:
                f.write('half a row and then...')
                raise RuntimeError('killed mid-write')
        self.assertEqual(io.open(self.target, encoding='utf-8').read(), self.original,
                         'a failed write must not touch the delivered file')

    def test_no_temp_file_is_left_behind_after_a_failure(self):
        try:
            with atomic_open(self.target, 'w', encoding='utf-8') as f:
                f.write('x')
                raise RuntimeError('boom')
        except RuntimeError:
            pass
        leftovers = [n for n in os.listdir(self.tmp) if n != 'delivered.csv']
        self.assertEqual(leftovers, [], 'temp files must be cleaned up: %r' % leftovers)

    def test_a_successful_write_replaces_the_content(self):
        with atomic_open(self.target, 'w', encoding='utf-8') as f:
            f.write('new,content\n')
        self.assertEqual(io.open(self.target, encoding='utf-8').read(), 'new,content\n')


class QuestionsSchemaTests(unittest.TestCase):
    """The questions sheet's shape is a cross-language contract: English column
    names, identical to French's, `part` not `teil`."""

    def test_column_names_are_english_and_match_the_french_schema(self):
        self.assertIn('part', q_mod.COLUMNS)
        self.assertNotIn('teil', q_mod.COLUMNS)
        self.assertIn('level', q_mod.COLUMNS)

    def test_row_for_reads_the_legacy_teil_key(self):
        """Page records still carry `teil`; the rename was export-schema only,
        so no page data had to be rewritten."""
        row = q_mod.row_for('b', {'teil': 'Teil 1', 'item': '1'}, 'A1')
        self.assertEqual(row['part'], 'Teil 1')

    def test_part_prefers_the_new_key_when_both_exist(self):
        row = q_mod.row_for('b', {'teil': 'old', 'part': 'new'}, 'A1')
        self.assertEqual(row['part'], 'new')

    def test_printed_label_stays_verbatim_in_the_source_language(self):
        """English COLUMN NAME, source-language VALUE -- "Übung 3" is a quote
        from the book, not taxonomy."""
        self.assertEqual(q_mod.row_for('b', {'part': 'Übung 3'}, 'A1')['part'], 'Übung 3')

    def test_level_falls_back_to_the_collection_level(self):
        self.assertEqual(q_mod.row_for('b', {'item': '1'}, 'A1')['level'], 'A1')

    def test_every_row_has_exactly_the_declared_columns(self):
        row = q_mod.row_for('b', {'item': '1'}, 'A1')
        self.assertEqual(sorted(row), sorted(q_mod.COLUMNS))

    def test_values_are_flattened_to_single_cells(self):
        row = q_mod.row_for('b', {'question': 'line one\nline\ttwo'}, 'A1')
        self.assertEqual(row['question'], 'line one line two')


class SharedHelperTests(unittest.TestCase):
    """catalog.py used to carry its own copies of these. The duplication cost
    four double-fixes in a single day, and the &nbsp; fix was missed on this
    side until the export gate caught it in published data."""

    def test_catalog_uses_the_shared_helpers_not_local_copies(self):
        src = io.open(os.path.join(TOOLS, 'catalog.py'), encoding='utf-8').read()
        for fn in ('def page_title', 'def word_count', 'def split_frontmatter',
                   'def read_pages', 'def load_classification', 'def human_title'):
            self.assertNotIn(fn, src, '%s must come from _common, not be redefined' % fn)

    def test_html_comment_never_becomes_a_page_title(self):
        from _common import page_title
        self.assertEqual(page_title('<!-- blank page -->\n\n# Lektion 3'), 'Lektion 3')

    def test_entity_is_not_left_in_a_title(self):
        from _common import page_title
        self.assertEqual(page_title('Arbeitsalltag &nbsp; 7'), 'Arbeitsalltag 7')


if __name__ == '__main__':
    unittest.main()
