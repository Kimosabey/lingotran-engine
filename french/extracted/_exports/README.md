# French — Extraction Deliverables

Clean, content-team-ready exports. **All CSVs are UTF-8 with BOM** so accented
characters render correctly on double-click in Excel / Google Sheets.

## How this is organised

- `_combined/` — one merged sheet per data type, every book combined. Start here
  for bulk use; filter the `collection` column to isolate one book.
- `<collection>/` — one folder per book, holding that book's own catalog/questions/
  vocabulary CSVs **and** the whole book as a single readable `.md`. Open one folder
  to get just that book, no filtering needed.

Every file lives in exactly one place — nothing is duplicated between `_combined/`
and the per-book folders.

## Sheet columns

- **catalog** — one row per page: section, chapter, content type, activity, topic, level, status, word count, summary.
- **questions** — one row per item: section, part, item, item_type, question, option_a/b/c, correct_answer, level, topic, source_page.
- **vocabulary** — one row per word: word, article, plural, word_class, example, topic, source_page.

## Combined sheets (`_combined/`)

| Sheet | Rows |
|---|---|
| `french-catalog-all.csv` | 404 |
| `french-questions-all.csv` | 4164 |
| `french-vocabulary-all.csv` | 3903 |

## Books

| Book | Folder | Status | Pages | Questions | Words |
|---|---|---|---|---|---|
| Cosmopolite 1 - Methode de francais A1 * | `cosmopolite-a1-methode/` | included | 224 | 1751 | 1175 |
| Tricolore 1 - 5e edition * | `tricolore-1-5th-edition/` | included | 180 | 2413 | 2728 |
| Tricolore 2 - 5e edition | — | not yet processed | — | — | — |
| Saison 2 - Methode de francais A2-B1 | — | not yet processed | — | — | — |
| Cosmopolite 5 - Methode de francais C1-C2 | — | not yet processed | — | — | — |

_* see Known limitations below._

## Known limitations

- **Cosmopolite 1 - Methode de francais A1**: Page 3 (Avant-propos/foreword) could not be transcribed: its source image contains a real, identifiable, named person's photo (two author headshots), which the vision model's content-safety filter blocks on every processing approach. Not exercise/practice material -- publisher methodology prose only. See page-003.md and pages/_qa/page-003.json for the full note.
- **Cosmopolite 1 - Methode de francais A1**: 607 of 1751 questions (35%) have a blank correct_answer -- NOT a transcription gap. Confirmed via the book's own back cover (page 224): this coursebook's answer keys ('corrigés') are published in a separate companion 'Guide pedagogique' (teacher's guide), never printed in this book at all. ~47% of the blanks are additionally audio-dependent listening items (no audio track processed). SME FOLLOW-UP: if the companion Guide pedagogique PDF is ever sourced, its printed corriges could be used to re-run the enrichment answer-fill pass and resolve a meaningful share of these blanks.
- **Tricolore 1 - 5e edition**: 1091 of 2413 questions (45%) have a blank correct_answer -- NOT a transcription gap. Confirmed via recon (TOC + back matter): this coursebook's answers are published only in the separate Tricolore 1 Teacher's Book, never in this student volume. A further 196 items are legitimately open-ended (writing/speaking tasks with no single answer) and are separately marked "(open-ended)", not counted among the blanks. Many of the blanks are also audio-dependent listening items (no audio track processed). SME FOLLOW-UP: if the Teacher's Book PDF is ever sourced, its printed answers could be used to re-run the enrichment answer-fill pass and resolve a meaningful share of these blanks.
- **Tricolore 1 - 5e edition**: 6 of 180 pages have a disclosed, individually-reviewed permanent transcription gap after a dedicated repair pass (aggressive re-zoom, per-page): p11 (hand-drawn number-to-face matching diagram, exercise 3 -- 5 of 8 connections confirmed via pixel-level line-tracing, 3 remain genuinely ambiguous where multiple hand-drawn lines cross within 1-2px of a face outline with no single clean touch point); p53 and p54 (decorative illustrated book/poster-item cover titles in cursive/stylized fonts -- confirmed via up to 10x LANCZOS upscale + contrast-stretch that the source scan allocates only ~70-225px total to each title, a genuine resolution ceiling, not exercise-answer-critical); p80 (a poster's ticket-website/phone fine print -- traced back to the source PDF's embedded JPEG, confirmed only ~5-6 pixels tall per text line at native resolution); p136 (a photo credit's 'Copyright - ' caption physically cut off at the trimmed right edge of the scan -- confirmed via pixel-level inspection that the image data ends ~6px past the last visible character, nothing to recover); p161 (two decorative event-ticket graphics in stylized cursive script -- core legible words confirmed, but connecting phrases remain unconfirmable at native resolution). None of these are exercise/answer-critical content; all are decorative/incidental page elements. See each page's _qa/page-NNN.json for the full repair-pass finding.

_Generated by `_engine/package_exports.py` — re-run to refresh._
