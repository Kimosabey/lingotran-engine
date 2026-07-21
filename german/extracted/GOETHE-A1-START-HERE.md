# Goethe-Zertifikat A1 — extracted content (START HERE)

Guide for the content team. Everything below was extracted from the **official,
free Goethe-Institut A1 practice materials** (goethe.de) — 7 source PDFs,
**302 pages, 100% transcribed and QA-verified**.

Two exam variants:
- **Start Deutsch 1** (adults) — `goethe-a1-sd1-*`
- **Fit in Deutsch 1** (young people) — `goethe-a1-fit1-*`

---

## Which file do I open?

| I want to… | Open |
| --- | --- |
| **Read a whole exam paper** end-to-end | `goethe-a1-*/…<name>.md` (unified doc) |
| **Browse/filter all pages** (what's on each page) | `goethe-a1-catalog-all.csv` |
| **Build quizzes / flashcards** (questions + answers) | `goethe-a1-questions-all.csv` |
| **Build vocabulary drills** (words + article/plural/example) | `goethe-a1-vocabulary-all.csv` |
| Work on **one PDF only** | that collection's folder — it has all three files |
| Check extraction progress/state | `MANIFEST-MEDIA.md` (dashboard) · `manifest-media.tsv` (raw state) |

All `.csv` files are UTF-8 **with BOM** — double-click opens correctly in Excel
(German umlauts intact). In Excel use **Data → Filter**; in Google Sheets
**File → Import**.

---

## The three deliverables (per PDF)

Inside every `goethe-a1-*/` folder:

**1. `<collection>.md` — the unified document**
One readable file per PDF: a title, an **overview** (pages grouped by skill
section / content type / activity / topic), a scannable **page index**
(page · section · activity · topic · one-line summary), then the **full verbatim
transcription** of every page in order.

**2. `<collection>-catalog.csv` — the page sheet** (one row per page)
`collection, unit, section, content_type, activity_type, topic, level, status, qa, word_count, summary, title`

**3. `<collection>-questions.csv` — the question sheet** (one row per exam item)
`collection, section, teil, item, item_type, question, option_a, option_b, option_c, correct_answer, topic, source_page`

### How options behave per activity (`item_type`)
| item_type | options | correct_answer |
| --- | --- | --- |
| `multiple-choice` | option_a / b / c filled | the letter, e.g. `c` |
| `true-false` | option_a=`Richtig`, option_b=`Falsch` | `Richtig` or `Falsch` |
| `matching` | the candidate choices | the matched choice |
| `fill-in` | (none) | the expected value |
| `open` (Schreiben/Sprechen) | (none) | `(open-ended)` — no key exists |

**247 question items total:** 63 multiple-choice · 69 true-false · 15 fill-in ·
11 matching · 89 open-ended. **158 carry a keyed correct answer** (taken from the
Lösungen pages); the 89 open-ended writing/speaking prompts have no official key.

**4. `<collection>-vocabulary.csv` — the word sheet** (two Wortliste PDFs only)
`collection, word, article, plural, word_class, example, topic, source_page`

**1,564 words total** (Start Deutsch 1: 808 · Fit in Deutsch 1: 756), 753 nouns
with their `der/die/das` + plural, and 1,356 carrying the printed example phrase.

---

## Vocabulary used for grouping

`section`: `hoeren` · `lesen` · `schreiben` · `sprechen` (+ `answer-key`, blank for front-matter)

`topic`: `travel` · `food` · `restaurant` · `weather` · `school` · `profession` ·
`family` · `vacation` · `hobby` · `shopping` · `home` · `daily-routine` · `health` ·
`city-places` · `time-dates` · `personal-info` · `communication` · `mixed` · `none`

`activity_type`: `multiple-choice` · `true-false` · `matching` · `ordering` ·
`fill-in` · `open` · `listening-comprehension` · `reading-comprehension` ·
`speaking-task` · `writing-task` · `vocabulary` · `instructions` · `cover` · `answer-key`

---

## Regenerating (if pages change)

```bash
cd german/extracted
python _tools/catalog.py --all      # rebuild unified .md + page sheets
python _tools/questions.py --all    # rebuild question sheets
python _tools/vocabulary.py --all   # rebuild word sheets
python _tools/manifest_media.py dashboard
```

Adding another PDF source: add one entry to `_tools/collections.json` — no code
changes. **How the whole extraction was done** (pipeline, workflows, runbook,
gotchas): see [`EXTRACTION-WORKFLOW.md`](./EXTRACTION-WORKFLOW.md).

---

## Notes & limits

- **Audio/listening transcripts** — out of scope for this pass (one sample exists
  under `goethe-a1-sd1-exam-training-1/audio/`).
- **`topic` and `activity_type` are LLM-assigned** navigation aids, not official
  Goethe metadata.
- **Open-ended Schreiben/Sprechen items carry `(open-ended)`** — no official
  answer key exists for them.
- Six pages in the Wortlisten are *"INVENTARE"* (thematic/grammar inventories, not
  headword lists) and correctly contribute no word rows.
