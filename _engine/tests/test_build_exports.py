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
from build_exports import _flat, page_title


class FlatNoneTests(unittest.TestCase):
    def test_none_becomes_empty_string_not_the_word_none(self):
        self.assertEqual(_flat(None), '')

    def test_normal_string_unaffected(self):
        self.assertEqual(_flat('hello world'), 'hello world')

    def test_collapses_internal_whitespace(self):
        self.assertEqual(_flat('line one\nline\ttwo'), 'line one line two')

    def test_empty_string_stays_empty(self):
        self.assertEqual(_flat(''), '')


class PageTitleTests(unittest.TestCase):
    """The catalog's `title` column is a page's real heading. A transcriber's
    HTML comment, a running page-number footer, or markup entities are not
    headings -- French exports shipped all three until this was ported over
    from german/extracted/_tools/catalog.py.
    """

    def test_skips_single_line_html_comment(self):
        body = '<!-- this page is blank (verified: solid white) -->\n\n# Glossaire'
        self.assertEqual(page_title(body), 'Glossaire')

    def test_skips_multi_line_html_comment(self):
        body = '<!-- Faint show-through from the printed\nreverse side is visible -->\n\nUnite 3'
        self.assertEqual(page_title(body), 'Unite 3')

    def test_comment_only_page_yields_empty_title(self):
        self.assertEqual(page_title('<!-- blank page, nothing printed -->'), '')

    def test_strips_inline_trailing_comment(self):
        self.assertEqual(page_title('Acknowledgements <!-- no footer here -->'), 'Acknowledgements')

    def test_skips_bare_page_number_footer(self):
        self.assertEqual(page_title('14\n\n# Dossier 2'), 'Dossier 2')
        self.assertEqual(page_title('Page 14\n\nDossier 2'), 'Dossier 2')

    def test_collapses_entities_and_whitespace_runs(self):
        body = 'LEÇON 3 &nbsp; Les Français   et   la lecture   '
        self.assertEqual(page_title(body), 'LEÇON 3 Les Français et la lecture')

    def test_plain_heading_still_works(self):
        self.assertEqual(page_title('# Acknowledgements\n\nbody text'), 'Acknowledgements')

    def test_truncates_to_90_chars(self):
        self.assertEqual(len(page_title('x' * 200)), 90)


if __name__ == '__main__':
    unittest.main()
