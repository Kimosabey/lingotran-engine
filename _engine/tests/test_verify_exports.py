#!/usr/bin/env python
"""verify_exports.py is the deliverable gate: it checks what a recipient
actually opens, which reconcile.py and verify_answers.py never look at.

Every case below is a defect that really shipped, or the direct generalization
of one, so a regression here means a known-bad export could go out again.
"""
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import verify_exports as V

QCOLS = ','.join(V.CANON['questions'])
CCOLS = ','.join(V.CANON['catalog'])


def q_row(**kw):
    d = {c: '' for c in V.CANON['questions']}
    d.update(collection='b', item='1', item_type='short-answer', question='Wie geht es?',
             level='A1', topic='family', source_page='001')
    d.update(kw)
    return ','.join('"%s"' % d[c] for c in V.CANON['questions'])


class Harness(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.book = os.path.join(self.root, 'b')
        os.makedirs(self.book)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, name, text):
        p = os.path.join(self.book, name)
        with io.open(p, 'w', encoding='utf-8-sig', newline='') as f:
            f.write(text)
        return p

    def run_gate(self):
        return V.main(['--root', self.root, '--quiet'])

    def failures_for(self, name, text):
        self.write(name, text)
        fails = []
        rows = V.read_csv(os.path.join(self.book, name))
        V.check_rows(os.path.join(self.book, name), rows, lambda p, m: fails.append(m))
        V.check_taxonomy(os.path.join(self.book, name), rows,
                         lambda p, m: fails.append(m), {})
        return fails


class CleanExportPasses(Harness):
    def test_a_clean_book_passes(self):
        self.write('b-questions.csv', QCOLS + '\n' + q_row() + '\n')
        self.assertEqual(self.run_gate(), 0)


class TaxonomyTests(Harness):
    def test_non_english_taxonomy_value_fails(self):
        """German shipped `section: hoeren` for a long time. The rule is
        written as "no non-ASCII letters" so it generalises to any future
        language without a per-language blocklist."""
        f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(topic='Freizeitä') + '\n')
        self.assertTrue(any('non-English taxonomy value' in x for x in f), f)

    def test_cyrillic_and_cjk_taxonomy_values_fail(self):
        for bad in ('чтение', '読解'):
            f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(topic=bad) + '\n')
            self.assertTrue(any('non-English taxonomy value' in x for x in f),
                            'should reject %r' % bad)

    def test_decorated_level_value_fails(self):
        """tricolore-2 recorded all 2,750 items as "A2 (inferred)", which
        silently broke every level filter on the combined sheet."""
        f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(level='A2 (inferred)') + '\n')
        self.assertTrue(any('invalid `level`' in x for x in f), f)

    def test_bare_level_passes(self):
        f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(level='B1') + '\n')
        self.assertEqual([x for x in f if 'level' in x], [])

    def test_content_type_confused_with_section_fails(self):
        f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(section='answer-key') + '\n')
        self.assertTrue(any('invalid `section`' in x for x in f), f)

    def test_near_miss_enum_value_fails(self):
        """"open" instead of the documented "open-ended" -- 89 German items."""
        f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(item_type='open') + '\n')
        self.assertTrue(any('invalid `item_type`' in x for x in f), f)

    def test_slugified_prose_in_open_vocab_fails(self):
        """21 tricolore-2 pages once carried slugified chapter titles like
        `module-3-de-jour-en-jour` as a taxonomy value."""
        row = ','.join('"%s"' % v for v in
                       ['b', 'page-001', 'none', '', '[module-3-de-jour-en-jour]', '', '',
                        'A1', 'verified', 'pass', '10', 's', 't'])
        f = self.failures_for('b-catalog.csv', CCOLS + '\n' + row + '\n')
        self.assertTrue(any('slugified prose' in x for x in f), f)


class CellHygieneTests(Harness):
    def test_html_comment_in_a_cell_fails(self):
        """16 French catalog rows shipped titled `<!-- this page is blank -->`."""
        f = self.failures_for('b-questions.csv',
                              QCOLS + '\n' + q_row(question='<!-- blank page -->') + '\n')
        self.assertTrue(any('html or comment' in x for x in f), f)

    def test_html_entity_in_a_cell_fails(self):
        """A German catalog title read "Arbeitsalltag &nbsp; 7"."""
        f = self.failures_for('b-questions.csv',
                              QCOLS + '\n' + q_row(question='Arbeitsalltag &nbsp; 7') + '\n')
        self.assertTrue(any('HTML entity' in x for x in f), f)

    def test_untrimmed_and_double_spaced_cells_fail(self):
        f = self.failures_for('b-questions.csv', QCOLS + '\n' + q_row(question='Hallo  Welt ') + '\n')
        self.assertTrue(any('untrimmed' in x for x in f), f)
        self.assertTrue(any('run of 2+ spaces' in x for x in f), f)

    def test_accented_source_language_text_is_fine_in_a_text_cell(self):
        """Only TAXONOMY columns are English. Verbatim text stays in the source
        language, so this must not be flagged."""
        f = self.failures_for('b-questions.csv',
                              QCOLS + '\n' + q_row(question='Où est la gare ?') + '\n')
        self.assertEqual(f, [])

    def test_header_only_file_fails(self):
        f = self.failures_for('b-questions.csv', QCOLS + '\n')
        self.assertTrue(any('header-only' in x for x in f), f)


class SchemaTests(Harness):
    def test_non_english_column_name_fails(self):
        """German named the column `teil` where French named it `part`."""
        hdr = QCOLS.replace('part', 'teil')
        self.write('b-questions.csv', hdr + '\n' + q_row() + '\n')
        self.assertEqual(self.run_gate(), 1)

    def test_inconsistent_headers_within_a_language_fail(self):
        os.makedirs(os.path.join(self.root, 'b2'))
        self.write('b-questions.csv', QCOLS + '\n' + q_row() + '\n')
        with io.open(os.path.join(self.root, 'b2', 'b2-questions.csv'), 'w',
                     encoding='utf-8-sig', newline='') as f:
            f.write(','.join(c for c in V.CANON['questions'] if c != 'level') + '\n"b2"\n')
        self.assertEqual(self.run_gate(), 1)


class PageReferenceTests(Harness):
    def test_question_citing_a_page_the_catalog_lacks_fails(self):
        cat = ','.join('"%s"' % v for v in
                       ['b', 'page-001', 'none', '', '[exercise]', '', '', 'A1',
                        'verified', 'pass', '10', 's', 't'])
        self.write('b-catalog.csv', CCOLS + '\n' + cat + '\n')
        self.write('b-questions.csv', QCOLS + '\n' + q_row(source_page='999') + '\n')
        self.assertEqual(self.run_gate(), 1)

    def test_matching_page_reference_passes(self):
        cat = ','.join('"%s"' % v for v in
                       ['b', 'page-001', 'none', '', '[exercise]', '', '', 'A1',
                        'verified', 'pass', '10', 's', 't'])
        self.write('b-catalog.csv', CCOLS + '\n' + cat + '\n')
        self.write('b-questions.csv', QCOLS + '\n' + q_row(source_page='001') + '\n')
        self.assertEqual(self.run_gate(), 0)


if __name__ == '__main__':
    unittest.main()


class CoverageTests(Harness):
    """The gate that was missing. Every other check validates SHAPE; none asked
    whether a column that ought to be populated actually is. A German questions
    export shipped at 8.7% `instruction` coverage and passed everything else,
    because the chunks had been backfilled but never re-merged.
    """

    def _collections(self, expect):
        os.makedirs(os.path.join(self.root, '_tools'), exist_ok=True)
        with io.open(os.path.join(self.root, '_tools', 'collections.json'), 'w',
                     encoding='utf-8') as f:
            json.dump({'collections': [{'slug': 'b', 'expect_coverage': expect}]}, f)

    def _questions(self, instructions):
        rows = [QCOLS]
        for n, ins in enumerate(instructions, 1):
            d = {c: '' for c in V.CANON['questions']}
            d.update(collection='b', item=str(n), item_type='short-answer',
                     question='Q%d' % n, instruction=ins, level='A1',
                     topic='family', source_page='001')
            rows.append(','.join('"%s"' % d[c] for c in V.CANON['questions']))
        self.write('b-questions.csv', '\n'.join(rows) + '\n')

    def test_empty_column_fails_when_coverage_is_expected(self):
        self._collections({'instruction': 95})
        self._questions(['', '', '', ''])
        self.assertEqual(self.run_gate(), 1, 'a stale, empty column must not ship')

    def test_full_column_passes(self):
        self._collections({'instruction': 95})
        self._questions(['Complete.'] * 4)
        self.assertEqual(self.run_gate(), 0)

    def test_partial_below_floor_fails(self):
        """The real case was 8.7%, which looked plausible enough to ship."""
        self._collections({'instruction': 95})
        self._questions(['Complete.'] + [''] * 9)
        self.assertEqual(self.run_gate(), 1)

    def test_zero_is_legitimate_when_declared_zero(self):
        """Cosmopolite genuinely has 0% translation -- it is monolingual. A
        declared 0 must pass, not be treated as a failure."""
        self._collections({'instruction': 0})
        self._questions([''] * 4)
        self.assertEqual(self.run_gate(), 0)

    def test_expectation_only_applies_to_the_sheet_that_owns_the_column(self):
        """`instruction` is a questions field. Declaring it must not fail the
        vocabulary or catalog sheets, which never had that column."""
        self._collections({'instruction': 95})
        self._questions(['Complete.'] * 3)
        # Built from CANON rather than hardcoded, so adding a column (gender,
        # translation, ...) cannot silently break this test.
        vocab = {c: '' for c in V.CANON['vocabulary']}
        vocab.update(collection='b', word='chat', translation='cat',
                     word_class='noun', topic='none', source_page='001')
        self.write('b-vocabulary.csv',
                   ','.join(V.CANON['vocabulary']) + '\n' +
                   ','.join('"%s"' % vocab[c] for c in V.CANON['vocabulary']) + '\n')
        self.assertEqual(self.run_gate(), 0)

    def test_undeclared_column_is_never_failed(self):
        """Silence must not be mistaken for approval -- but nor should an
        undeclared column block a delivery."""
        self._collections({})
        self._questions([''] * 4)
        self.assertEqual(self.run_gate(), 0)
