#!/usr/bin/env python
"""START-HERE.md is the content team's orientation page.

It used to be a hardcoded prose block inside German's packager -- so German's
numbers had to be hand-edited whenever the corpus changed, and French had no
such page at all, leaving the two deliverables with different shapes. One
shared builder, driven by the real counts, fixes both. These tests pin that it
stays data-driven and language-neutral.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import build_start_here

BOOKS = [
    {'title': 'Book One', 'folder': 'book-one', 'pages': 224,
     'questions': 1751, 'words': 1175, 'caveats': ['answers are in a separate guide']},
    {'title': 'Book Two', 'folder': 'book-two', 'pages': 180,
     'questions': 2413, 'words': 2728, 'caveats': []},
]
COMBINED = [('x-catalog-all.csv', 404), ('x-questions-all.csv', 4164)]


class StartHereTests(unittest.TestCase):
    def test_totals_are_summed_from_the_books_not_hardcoded(self):
        out = build_start_here('french', BOOKS, COMBINED)
        self.assertIn('404 pages', out)          # 224 + 180
        self.assertIn('4,164 practice questions', out)   # 1751 + 2413
        self.assertIn('3,903 vocabulary entries', out)   # 1175 + 2728

    def test_book_count_and_names_come_from_the_data(self):
        out = build_start_here('french', BOOKS, COMBINED)
        self.assertIn('**2 books**', out)
        self.assertIn('`book-one/`', out)
        self.assertIn('Book Two', out)

    def test_language_name_is_used_verbatim(self):
        for lang in ('french', 'german', 'japanese'):
            self.assertIn('START HERE — %s datasets' % lang.title(),
                          build_start_here(lang, BOOKS, COMBINED))

    def test_no_language_specific_content_leaks_in(self):
        """The builder must not name a publisher, level or script -- otherwise
        it stops being reusable the moment a new language arrives."""
        out = build_start_here('japanese', BOOKS, COMBINED).lower()
        for term in ('goethe', 'netzwerk', 'didier', 'a1', 'umlaut', 'accent'):
            self.assertNotIn(term, out, 'leaked %r' % term)

    def test_caveated_books_are_marked_and_explained(self):
        out = build_start_here('french', BOOKS, COMBINED)
        self.assertIn('Book One *', out)
        self.assertIn('known limitations', out.lower())

    def test_combined_row_is_omitted_when_there_is_no_combined_folder(self):
        with_c = build_start_here('french', BOOKS, COMBINED)
        without = build_start_here('french', BOOKS, None)
        self.assertIn('_combined/', with_c)
        self.assertNotIn('| Work across every book at once', without)

    def test_singular_wording_for_a_single_book(self):
        out = build_start_here('french', [BOOKS[0]], None)
        self.assertIn('**1 book**', out)
        self.assertNotIn('**1 books**', out)

    def test_empty_corpus_does_not_claim_content(self):
        out = build_start_here('spanish', [], None)
        self.assertIn('Nothing has been', out)
        self.assertNotIn('0 pages ·', out)

    def test_names_its_generator_so_nobody_hand_edits_it(self):
        out = build_start_here('french', BOOKS, COMBINED, generator='_engine/package_exports.py')
        self.assertIn('_engine/package_exports.py', out)
        self.assertIn('do not hand-edit', out)


if __name__ == '__main__':
    unittest.main()
