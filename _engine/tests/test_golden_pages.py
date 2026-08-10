#!/usr/bin/env python
"""Golden-page fixtures: pin the page-markdown -> export-row contract.

Every other test here checks one function in isolation. These freeze a handful
of deliberately awkward pages and assert what they become in the catalog, so a
future edit to the export path that quietly drops accents, swallows a title, or
mis-parses frontmatter fails loudly instead of shipping.

Each fixture is a real defect class from this corpus, not an invented one.
"""
import io
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from build_exports import split_frontmatter, page_title, word_count, _flat

FIXTURES = {
    # A transcriber's note must not become the page title (16 French rows shipped
    # titled "<!-- this page is blank ... -->").
    'comment_only_before_heading': (
        '---\npage: 1\ncontent_type: [wordlist]\n---\n'
        '<!-- running header, top right -->\n\n# Glossaire\n\nabbaye  abbey\n',
        {'title': 'Glossaire', 'content_type': '[wordlist]'},
    ),
    # A genuinely blank page yields no title at all rather than the comment text.
    'blank_page': (
        '---\npage: 2\ncontent_type: []\n---\n'
        '<!-- blank page: uniformly white, nothing printed -->\n',
        {'title': '', 'content_type': '[]'},
    ),
    # Accents and the source language survive verbatim into the title.
    'accented_heading': (
        '---\npage: 3\ncontent_type: [chapter-opener]\n---\n'
        '# Unité 3 — Où est la gare ?\n\nBonjour !\n',
        {'title': 'Unité 3 — Où est la gare ?'},
    ),
    # An HTML entity is markup, not printed text ("Arbeitsalltag &nbsp; 7").
    'entity_in_heading': (
        '---\npage: 4\ncontent_type: [chapter-opener]\n---\n'
        'Arbeitsalltag &nbsp; 7\n',
        {'title': 'Arbeitsalltag 7'},
    ),
    # A running footer is not a heading.
    'page_number_before_heading': (
        '---\npage: 5\ncontent_type: [exercise]\n---\n'
        '14\n\n## Exercice 2\n',
        {'title': 'Exercice 2'},
    ),
    # Multi-value content_type keeps its order and spacing.
    'multi_content_type': (
        '---\npage: 6\ncontent_type: [lesson, exercise, grammar-box]\n---\n'
        '# Leçon 6\n',
        {'content_type': '[lesson, exercise, grammar-box]', 'title': 'Leçon 6'},
    ),
}


class GoldenPageTests(unittest.TestCase):
    def test_fixtures_produce_expected_catalog_fields(self):
        for name, (md, expected) in sorted(FIXTURES.items()):
            fm, body = split_frontmatter(md)
            got = {'title': page_title(body.strip()),
                   'content_type': fm.get('content_type', '')}
            for k, want in expected.items():
                self.assertEqual(got[k], want,
                                 '%s: %s expected %r, got %r' % (name, k, want, got[k]))

    def test_no_fixture_leaks_markup_into_its_title(self):
        for name, (md, _) in sorted(FIXTURES.items()):
            _, body = split_frontmatter(md)
            t = page_title(body.strip())
            for bad in ('<!--', '-->', '&nbsp;', '**', '##'):
                self.assertNotIn(bad, t, '%s leaked %r into title' % (name, bad))
            self.assertEqual(t, t.strip(), '%s left padding in title' % name)

    def test_titles_are_single_clean_cells(self):
        for name, (md, _) in sorted(FIXTURES.items()):
            _, body = split_frontmatter(md)
            t = page_title(body.strip())
            self.assertEqual(_flat(t), t, '%s title would be reflowed by _flat' % name)


class WordCountTests(unittest.TestCase):
    """word_count feeds a column compared across books and languages, so a
    space-separated script and a CJK script must both report sensibly."""

    def test_counts_words_for_space_separated_scripts(self):
        self.assertEqual(word_count('bonjour tout le monde'), 4)

    def test_counts_characters_for_cjk(self):
        # Whitespace tokenisation would report 1 for this line.
        self.assertEqual(word_count('これはテストです'), 8)

    def test_mixed_script_counts_each_part_in_its_own_convention(self):
        self.assertEqual(word_count('Kanji 漢字 test'), 4)  # 2 latin + 2 han

    def test_empty_body_is_zero(self):
        self.assertEqual(word_count(''), 0)


if __name__ == '__main__':
    unittest.main()
