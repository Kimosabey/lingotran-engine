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
- **vocabulary** — one row per word: word, translation, article, plural, word_class, example, topic, source_page.
  `translation` is the meaning **as printed by the book**, so it is filled only for BILINGUAL books.
  A monolingual book prints no gloss, so the column is blank for it -- that is the book, not missing data.
  Blank `plural` / `example` mean the same thing: the book does not print them for that entry.

## Combined sheets (`_combined/`)

| Sheet | Rows |
|---|---|
| `french-catalog-all.csv` | 584 |
| `french-questions-all.csv` | 6914 |
| `french-vocabulary-all.csv` | 5566 |

## Books

| Book | Folder | Status | Pages | Questions | Words |
|---|---|---|---|---|---|
| Cosmopolite 1 - Methode de francais A1 * | `cosmopolite-a1-methode/` | included | 224 | 1751 | 1175 |
| Tricolore 1 - 5e edition * | `tricolore-1-5th-edition/` | included | 180 | 2413 | 2728 |
| Tricolore 2 - 5e edition * | `tricolore-2-5th-edition/` | included | 180 | 2750 | 1663 |
| Saison 2 - Methode de francais A2-B1 | — | not yet processed | — | — | — |
| Cosmopolite 5 - Methode de francais C1-C2 | — | not yet processed | — | — | — |
| Reussir le DELF Prim A1.1 - A1 * | — | not yet processed | — | — | — |

_* see Known limitations below._

## Known limitations

- **Cosmopolite 1 - Methode de francais A1**: Page 3 (Avant-propos/foreword) could not be transcribed: its source image contains a real, identifiable, named person's photo (two author headshots), which the vision model's content-safety filter blocks on every processing approach. Not exercise/practice material -- publisher methodology prose only. See page-003.md and pages/_qa/page-003.json for the full note.
- **Cosmopolite 1 - Methode de francais A1**: 607 of 1751 questions (35%) have a blank correct_answer -- NOT a transcription gap. Confirmed via the book's own back cover (page 224): this coursebook's answer keys ('corrigés') are published in a separate companion 'Guide pedagogique' (teacher's guide), never printed in this book at all. ~47% of the blanks are additionally audio-dependent listening items (no audio track processed). SME FOLLOW-UP: if the companion Guide pedagogique PDF is ever sourced, its printed corriges could be used to re-run the enrichment answer-fill pass and resolve a meaningful share of these blanks.
- **Cosmopolite 1 - Methode de francais A1**: The `translation` column is EMPTY for all 1,175 vocabulary entries in this book, and that is correct, not a gap. Cosmopolite 1 is a monolingual French method book (methode de francais): it teaches French through French and prints no English gloss anywhere in its word lists. The column exists in the shared French vocabulary sheet because the Tricolore books ARE bilingual and print an `Article | French | English` glossary, from which 4,303 meanings were captured. Nothing was lost here -- there was nothing printed to capture. If the content team needs English meanings for this book, they must be generated rather than extracted, and should be kept in a separate, clearly-labelled column so generated text is never mistaken for the book's own words.
- **Tricolore 1 - 5e edition**: 1091 of 2413 questions (45%) have a blank correct_answer -- NOT a transcription gap. Confirmed via recon (TOC + back matter): this coursebook's answers are published only in the separate Tricolore 1 Teacher's Book, never in this student volume. A further 196 items are legitimately open-ended (writing/speaking tasks with no single answer) and are separately marked "(open-ended)", not counted among the blanks. Many of the blanks are also audio-dependent listening items (no audio track processed). SME FOLLOW-UP: if the Teacher's Book PDF is ever sourced, its printed answers could be used to re-run the enrichment answer-fill pass and resolve a meaningful share of these blanks.
- **Tricolore 1 - 5e edition**: 6 of 180 pages have a disclosed, individually-reviewed permanent transcription gap after a dedicated repair pass (aggressive re-zoom, per-page): p11 (hand-drawn number-to-face matching diagram, exercise 3 -- 5 of 8 connections confirmed via pixel-level line-tracing, 3 remain genuinely ambiguous where multiple hand-drawn lines cross within 1-2px of a face outline with no single clean touch point); p53 and p54 (decorative illustrated book/poster-item cover titles in cursive/stylized fonts -- confirmed via up to 10x LANCZOS upscale + contrast-stretch that the source scan allocates only ~70-225px total to each title, a genuine resolution ceiling, not exercise-answer-critical); p80 (a poster's ticket-website/phone fine print -- traced back to the source PDF's embedded JPEG, confirmed only ~5-6 pixels tall per text line at native resolution); p136 (a photo credit's 'Copyright - ' caption physically cut off at the trimmed right edge of the scan -- confirmed via pixel-level inspection that the image data ends ~6px past the last visible character, nothing to recover); p161 (two decorative event-ticket graphics in stylized cursive script -- core legible words confirmed, but connecting phrases remain unconfirmable at native resolution). None of these are exercise/answer-critical content; all are decorative/incidental page elements. See each page's _qa/page-NNN.json for the full repair-pass finding.
- **Tricolore 2 - 5e edition**: 1589 of 2750 questions (58%) have a blank correct_answer -- NOT a transcription gap. Confirmed via recon (TOC + back matter, 2026-08-10): this coursebook's answers are published only in the separate Tricolore 2 Teacher's Book, never in this student volume. A further 270 items are legitimately open-ended (writing/speaking tasks with no single answer) and are separately marked "(open-ended)", not counted among the blanks. 467 of the blanks are audio-dependent listening items (no audio track processed). SME FOLLOW-UP: if the Teacher's Book PDF is ever sourced, its printed answers could be used to re-run the enrichment answer-fill pass and resolve a meaningful share of these blanks.
- **Tricolore 2 - 5e edition**: 9 of 180 pages have a disclosed transcription gap. Page 16: a few unlabeled illustration items on two shopping-trolley drawings (a sausage/meat item, a jam jar, a torn potato bag, a tomato, a butter package) are not legibly printed at source resolution -- everything else on the page, including all three exercises and both grammar boxes, is transcribed verbatim. Pages 167, 168, 170, 171, 173, 175, 176 and 177: eight pages of the end-of-book alphabetical glossary that could not be reproduced because every attempt to write out their entry lists triggers a hard content-filter block that terminates the process. The pages themselves were re-rasterized and directly reviewed on 2026-08-10 and contain ordinary French-English GCSE vocabulary -- this is platform-side flakiness on these specific pages, not sensitive content and not a scan-quality problem, and retries are capped per PLAYBOOK.md rather than repeated indefinitely. The surrounding glossary pages (166, 169, 172, 174, 177's neighbours) transcribed cleanly, so the glossary is partially, not wholly, covered. Each affected page's _qa/page-NNN.json records the full finding.
- **Tricolore 2 - 5e edition**: Pages 2, 4, 178 and 179 embed a 1-channel grayscale JPEG while the PDF declares the image /DeviceRGB, so MuPDF originally rendered them as near-black garbage. Page 178 (Acknowledgements) had been written off as a permanent content-filter gap purely because of this, and page 179 as a defective scan. Both were resolved on 2026-08-10: pdf_to_images.py now detects the mismatch and decodes the embedded scan directly. Page 178 is fully transcribed; pages 2 and 179 are confirmed genuinely blank.
- **Reussir le DELF Prim A1.1 - A1**: SOURCE PDF IS INCOMPLETE - roughly the last 20 printed pages are absent. The book's own Sommaire runs to at least printed page 93, but the PDF stops at printed page 75 (PDF page 71; printed = PDF + 4, verified). Missing: the remainder of 'Les epreuves blanches A1.1' (Comprehension des ecrits p77, Production ecrite p80, Production orale p83) and the ENTIRE 'Les epreuves blanches A1' section (p85-93+), plus anything printed after it. Since the title promises both A1.1 and A1, the missing part is a substantial share of the book's stated purpose. DECIDE BEFORE STARTING: source a complete copy, or process this one and disclose the truncation as a permanent, documented gap.
- **Reussir le DELF Prim A1.1 - A1**: The 37-track audio archive has not been unpacked or verified against the exercises; no listening content is processed yet.

_Generated by `_engine/package_exports.py` — re-run to refresh._
