#!/usr/bin/env python
"""German pipeline tests, retargeted at the SHARED engine (gap P1).

German used to run a forked copy of the exporters. These tests were written
against that copy, so they pinned the fork's behaviour rather than the contract
-- which is how the two halves drifted: a fix landed in one and not the other,
and on 2026-08-11 that shipped CRLF line endings from German's writers against
LF everywhere else, failing the packaging gate.

The four exporter scripts are gone. What survives here is the part that is a
CONTRACT rather than an implementation detail:

  - a killed run must never corrupt an already-delivered file;
  - the questions schema is cross-language -- English names, `part` not `teil`;
  - the shared page helpers are used, never re-copied per language;
  - and no language may grow its own exporter again.

That last one is new, and is the point: the duplication is what cost four
double-fixes in a single day, so it is now a test rather than a habit.
"""
import glob
import io
import os
import shutil
import sys
import tempfile
import unittest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(TOOLS, '..', '..', '..'))
ENGINE = os.path.join(REPO, '_engine')
sys.path.insert(0, ENGINE)

import build_exports as bx
from _common import atomic_open, page_title


class AtomicWriteTests(unittest.TestCase):
    """German's writers were all bare open(..., 'w') until 2026-08-10, several
    of them writing already-delivered frozen deliverables."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.target = os.path.join(self.tmpdir, 'delivered.csv')
        with io.open(self.target, 'w', encoding='utf-8') as f:
            f.write('original,content\n')

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_a_crash_mid_write_leaves_the_previous_file_intact(self):
        with self.assertRaises(RuntimeError):
            with atomic_open(self.target, 'w', encoding='utf-8') as f:
                f.write('half a row')
                raise RuntimeError('killed mid-write')
        self.assertEqual(io.open(self.target, encoding='utf-8').read(), 'original,content\n')

    def test_no_temp_file_is_left_behind_after_a_failure(self):
        with self.assertRaises(RuntimeError):
            with atomic_open(self.target, 'w', encoding='utf-8') as f:
                f.write('x')
                raise RuntimeError('boom')
        leftovers = [n for n in os.listdir(self.tmpdir) if n.startswith('.tmp-atomic-')]
        self.assertEqual(leftovers, [])

    def test_a_successful_write_replaces_the_content(self):
        with atomic_open(self.target, 'w', encoding='utf-8') as f:
            f.write('new,content\n')
        self.assertEqual(io.open(self.target, encoding='utf-8').read(), 'new,content\n')


class QuestionsSchemaTests(unittest.TestCase):
    """The questions sheet's shape is a cross-language contract, so it is
    asserted against the shared engine that now builds both languages."""

    def test_column_names_are_english(self):
        self.assertIn('part', bx.QUESTIONS_COLUMNS)
        self.assertNotIn('teil', bx.QUESTIONS_COLUMNS)
        self.assertIn('level', bx.QUESTIONS_COLUMNS)

    def test_the_teil_shim_is_gone(self):
        """Gap P3. All 5,413 records were renamed to `part` and zero carry the
        old key, so a fallback could only ever hide an unmigrated record. The
        fork dropped it; the engine had kept it, and adopting the engine without
        this test would have silently brought it back."""
        src = io.open(os.path.join(ENGINE, 'build_exports.py'), encoding='utf-8').read()
        self.assertNotIn("it.get('teil'", src)


class ColumnOmissionTests(unittest.TestCase):
    """A language declares the columns it can never fill; it is never inferred
    from which columns happen to be empty in today's books."""

    def test_declared_columns_are_dropped(self):
        cfg = {'omit_columns': {'vocabulary': ['translation', 'gender']}}
        cols = bx.columns_for_kind('vocabulary', cfg)
        self.assertNotIn('translation', cols)
        self.assertNotIn('gender', cols)
        self.assertIn('word', cols)

    def test_no_config_means_the_full_schema(self):
        self.assertEqual(bx.columns_for_kind('vocabulary', {}), bx.VOCAB_COLUMNS)

    def test_omission_does_not_reorder_the_rest(self):
        cols = bx.columns_for_kind('catalog', {'omit_columns': {'catalog': ['chapter']}})
        self.assertEqual(cols, [c for c in bx.CATALOG_COLUMNS if c != 'chapter'])


class SharedHelperTests(unittest.TestCase):
    def test_html_comment_never_becomes_a_page_title(self):
        self.assertEqual(page_title('<!-- blank page -->\n\n# Lektion 3'), 'Lektion 3')

    def test_entity_is_not_left_in_a_title(self):
        self.assertEqual(page_title('Arbeitsalltag &nbsp; 7'), 'Arbeitsalltag 7')


class NoForkedExportersTest(unittest.TestCase):
    """The guard that makes P1 stick.

    German ran a forked copy of the exporters for months. Fixes landed on one
    side and not the other -- the CRLF writers, the &nbsp; decode, the teil
    rename -- and each divergence was found only after it reached a delivered
    file. Deleting the fork does not prevent the next one; this does.
    """

    FORBIDDEN = ('catalog.py', 'questions.py', 'vocabulary.py', 'merge_all.py',
                 'build_exports.py')

    def test_no_language_has_its_own_exporter(self):
        offenders = []
        for tools_dir in glob.glob(os.path.join(REPO, '*', 'extracted', '_tools')):
            for name in self.FORBIDDEN:
                p = os.path.join(tools_dir, name)
                if os.path.exists(p):
                    offenders.append(os.path.relpath(p, REPO))
        self.assertEqual(
            offenders, [],
            'exporters live in _engine/ and are shared. A per-language copy is how '
            'German drifted: %s' % ', '.join(offenders))


if __name__ == '__main__':
    unittest.main()
