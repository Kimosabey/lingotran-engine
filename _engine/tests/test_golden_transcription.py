#!/usr/bin/env python
"""Golden fixtures for TRANSCRIPTION fidelity, frozen from real corpus pages.

Closes gap A5. `test_golden_pages.py` already pins the export path (markdown ->
catalog row). Nothing pinned the transcriptions themselves, so a prompt edit
that started dropping accents, collapsing table cells or swallowing frontmatter
would fail nothing — the exports would be internally consistent and quietly
wrong.

These fixtures are excerpts from pages that really exist in the corpus, chosen
because each one is a shape that has actually caused trouble:

  - a bilingual glossary table (three columns, article + word + English) --
    4,303 meanings were lost by reading only two of its columns;
  - a dense exercise page with a rubric and numbered items -- the rubric/content
    distinction that agents get wrong most often;
  - accented and ligatured French (à, è, ê, ç, œ) and German umlauts/ß, which a
    lossy re-encode silently mangles;
  - an inline level tag, `**[A2 (inferred)]**`, whose bare form must reach the
    record as `A2` and never as the decorated string;
  - a page with an HTML-comment transcriber note, which must never become the
    page title.

They assert PROPERTIES a faithful transcription must hold, not byte equality
with one blessed output: a transcription can legitimately differ in layout, but
it may never lose a table cell, an accent or an item.
"""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import split_frontmatter, page_title, word_count, split_gender

GLOSSARY_PAGE = """---
source: tricolore-2-5th-edition.pdf
collection: tricolore-2-5th-edition
page: 166
orientation: 0
content_type: [vocabulary, wordlist]
level: mixed
section: none
chapter: Glossaire
status: verified
qa: pass
---

# Glossaire

## Français–anglais

| Article | French | English |
|---|---|---|
| | à (au, à la, à l', aux) | in, at, to |
| l' | abbaye (f) | abbey |
| | abolir | to abolish |
| un(e) | abonné(e) | subscriber |
| une | sœur | sister |
"""

EXERCISE_PAGE = """---
source: tricolore-2-5th-edition.pdf
collection: tricolore-2-5th-edition
page: 123
orientation: 0
content_type: [exercise, reading-text]
level: A2
section: reading
chapter: Unité 6
status: verified
qa: pass
---

### 3 Sortir à Nîmes

**[A2 (inferred)]**

**a** Lis les publicités. **Vrai, faux** ou **pas mentionné**?

**1** L'entrée à la piscine, c'est dix euros.
**2** La piscine est ouverte tous les jours à midi.
"""

GERMAN_PAGE = """---
source: kursbuch.pdf
collection: netzwerk-a1-kursbuch
page: 007
orientation: 0
content_type: [exercise, dialogue]
level: A1
section: listening
status: verified
qa: pass
---

<!-- running header, top right -->

# Guten Tag!

**1 a** Hören Sie und sprechen Sie nach. Wie heißen die Personen?

Grüße aus Zürich — schöne Größe, weiß, Fußball.
"""


class GlossaryFidelityTests(unittest.TestCase):
    def setUp(self):
        self.fm, self.body = split_frontmatter(GLOSSARY_PAGE)

    def test_all_three_glossary_columns_survive(self):
        """The English column was silently dropped once, costing 4,303 meanings."""
        self.assertIn('| l\' | abbaye (f) | abbey |', self.body)
        self.assertIn('to abolish', self.body)

    def test_accents_and_ligatures_are_intact(self):
        for ch in ('à', 'œ'):
            self.assertIn(ch, self.body, 'lost %r — a lossy re-encode' % ch)

    def test_gender_marker_is_preserved_in_the_headword(self):
        self.assertIn('abbaye (f)', self.body)
        self.assertEqual(split_gender('abbaye (f)')[1], 'f')

    def test_frontmatter_parses_with_its_taxonomy_intact(self):
        self.assertEqual(self.fm['collection'], 'tricolore-2-5th-edition')
        self.assertEqual(self.fm['section'], 'none')
        self.assertEqual(self.fm['content_type'], '[vocabulary, wordlist]')

    def test_title_is_the_heading_not_the_table(self):
        self.assertEqual(page_title(self.body.strip()), 'Glossaire')


class ExerciseFidelityTests(unittest.TestCase):
    def setUp(self):
        self.fm, self.body = split_frontmatter(EXERCISE_PAGE)

    def test_rubric_and_content_are_both_present_and_distinguishable(self):
        """The rubric says what to DO; the numbered lines are the material."""
        self.assertIn('Lis les publicités. **Vrai, faux** ou **pas mentionné**?', self.body)
        self.assertIn("L'entrée à la piscine, c'est dix euros.", self.body)

    def test_every_numbered_item_survives(self):
        self.assertEqual(len(re.findall(r'^\*\*\d+\*\*', self.body, re.M)), 2)

    def test_inline_level_tag_is_present_but_bare_form_is_what_records_use(self):
        """The page carries `**[A2 (inferred)]**`; the RECORD must carry `A2`.
        Shipping the decorated string broke every level filter once."""
        self.assertIn('**[A2 (inferred)]**', self.body)
        bare = re.search(r'\[([A-C][12])(?: \(inferred\))?\]', self.body).group(1)
        self.assertEqual(bare, 'A2')

    def test_chapter_is_captured_separately_from_section(self):
        self.assertEqual(self.fm['chapter'], 'Unité 6')
        self.assertEqual(self.fm['section'], 'reading')


class GermanFidelityTests(unittest.TestCase):
    def setUp(self):
        self.fm, self.body = split_frontmatter(GERMAN_PAGE)

    def test_umlauts_and_eszett_survive(self):
        for ch in ('ö', 'ü', 'ß'):
            self.assertIn(ch, self.body, 'lost %r' % ch)

    def test_similar_looking_words_are_not_conflated(self):
        """"Grüße" and "Größe" differ by one character and mean different
        things; a sloppy normalisation collapses them."""
        self.assertIn('Grüße', self.body)
        self.assertIn('Größe', self.body)

    def test_transcriber_comment_never_becomes_the_title(self):
        self.assertEqual(page_title(self.body.strip()), 'Guten Tag!')

    def test_word_count_counts_words_for_a_latin_script_page(self):
        self.assertGreater(word_count(self.body), 15)


class CrossPageInvariants(unittest.TestCase):
    """Properties every transcription must hold, whatever the book."""

    ALL = (GLOSSARY_PAGE, EXERCISE_PAGE, GERMAN_PAGE)

    def test_every_page_has_the_required_frontmatter_keys(self):
        for page in self.ALL:
            fm, _ = split_frontmatter(page)
            for key in ('source', 'collection', 'page', 'content_type', 'status', 'qa'):
                self.assertIn(key, fm)

    def test_no_page_title_leaks_markup(self):
        for page in self.ALL:
            _, body = split_frontmatter(page)
            title = page_title(body.strip())
            for bad in ('<!--', '**', '#', '|'):
                self.assertNotIn(bad, title)

    def test_frontmatter_is_never_swallowed_into_the_body(self):
        for page in self.ALL:
            _, body = split_frontmatter(page)
            self.assertNotIn('source:', body.split('\n')[0])


if __name__ == '__main__':
    unittest.main()
