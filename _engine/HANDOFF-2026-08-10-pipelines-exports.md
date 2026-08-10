# Pipeline & Exports Handoff v1.1 — "Verification Hardening + Re-upload Readiness"

**Name:** Pipeline & Exports Handoff
**Version:** v1.1 (supersedes v1.0, `HANDOFF-2026-07-28-pipelines-exports.md`)
**Date:** 2026-08-10
**Covers:** the PDF→CSV extraction/enrichment/export side only. Site design/frontend
(`site/`, `site-next/`) is owned by a different chat — updating site *data* is fine.

To resume, reference this as **"Pipeline & Exports Handoff v1.1"**. v1.0 is still
accurate for the German run's history and the Tricolore 2 transcription story; this
document supersedes it for **current state** and for the **verification gates**.

---

## Where things stand — one table

| Book | Language | Pages | State |
|---|---|---|---|
| 10 German collections | German | 636 | **Delivered & re-upload ready** |
| cosmopolite-a1-methode | French | 224 | **Done**, 21 disclosed gaps |
| tricolore-1-5th-edition | French | 180 | **Done**, 6 disclosed gaps |
| tricolore-2-5th-edition | French | 180 | **Done**, 9 disclosed gaps |
| saison-2-methode | French | 215 | **Not started** — pure scan, no text layer |
| cosmopolite-5-c1c2 | French | 226 | **Not started** — pure scan, no text layer |
| conjugaison-a1-a2 | French (legacy) | 106 | 104 transcribed, **only 67 QA'd** |
| revision-2 | French (legacy) | 181 | **Not started**, images rasterized |

Totals in the deliverable: French 12 CSV + 4 MD (6,914 questions, 5,566 vocabulary);
German 35 CSV + 12 MD (2,830 questions, 3,751 vocabulary).

The two legacy French books sit on German's older `_tools/` pipeline, are **not in
`collections.json`**, and are therefore invisible to `reconcile.py` and absent from the
French exports. That is a deliberate carry-over, but it means "French is done" is only
true of the three `_engine/` books.

---

## The verification gates — run all of these, in this order

This is the part that changed most in v1.1. Previously two gates existed and neither
looked at the delivered CSVs; a whole class of defect shipped undetected as a result.

| When | Command | Catches |
|---|---|---|
| after rasterizing | `pdf_to_images.py --root <lang>/extracted --audit --all` | blank / degenerate page images, **before** vision spend |
| after a wave | `reconcile.py --root <lang>/extracted --all` | missing pages, missing QA, classification holes, **incomplete `collections.json`** |
| after merge | `verify_answers.py --root <lang>/extracted --all` | answer shape/alignment, level tags, **answer-key rate vs declared status** |
| before delivery | `verify_exports.py --root <lang>/extracted` | schema, taxonomy, cell hygiene, page refs, packaging drift |
| always | `python -m unittest discover -s _engine/tests` | 91 tests |
| frozen langs | `git status --porcelain -- <lang>/` | must be empty |

A non-zero exit is a hard stop, not a warning.

### What `verify_exports.py` enforces

- **Column names are English and identical across languages** for the same sheet.
  `chapter` is the one legitimate exception (French only — German books have no chapter
  data, and an always-empty column reads worse than an absent one).
- **Closed enums** — `section`, `item_type`, `word_class`, `status`, `qa`, `level`.
- **No taxonomy value contains a non-ASCII letter, in any language.** This is the
  generic form of the old `section: hoeren` bug, written as a property rather than a
  per-language blocklist, so it works unchanged for Japanese, Russian or Arabic.
  Verbatim text columns are exempt — accents in a `question` are correct.
- **Cell hygiene** — no HTML/comments/entities, mojibake, embedded newlines, control
  characters, or ragged whitespace in human-read columns.
- **Open vocabularies** (`content_type`, `activity_type`, `topic`) report drift rather
  than failing, since new categories are legitimate. Review the list — this is how
  `defective-image` reached a shipped catalog.

---

## Standards (cumulative — v1.0's rule plus v1.1's)

1. **Taxonomy VALUES are English** in every language (v1.0).
2. **Column NAMES are English and identical across languages** (v1.1). `teil` → `part`;
   German's questions sheet gained `level`. The *values* stay verbatim — `part` still
   reads "Teil 1", "Übung 2", "Unité 3".
3. **`level` is a bare enum** — `A2`, never `A2 (inferred)`, never `A2+B1` (use `mixed`).
   The transcription tag is written `[A2 (inferred)]` on the page; the record gets the
   bare value.
4. **`content_type` is a CLOSED list of 28 values.** Don't coin synonyms, don't put an
   item_type there.
5. **A finished book must declare** `book_type`, `answer_key.status`, `caveats`,
   `accepted_qa_gaps`. `[]` = "reviewed, none"; absent = "never asked".
6. **Empty deliverable files are not shipped** — a booklet with no questions gets no
   questions CSV, matching how exam booklets already had no vocabulary CSV.

---

## Known-and-accepted (not bugs — do not "fix")

- **8 Tricolore 2 glossary pages** (167, 168, 170, 171, 173, 175, 176, 177) — every
  attempt to reproduce their entry lists trips a hard content-filter block. Re-attempted
  2026-08-10 in a fresh session: pages re-rasterize and read fine, output still blocked.
  Platform-side, not content, not scan quality. Retries capped per PLAYBOOK.md.
- **Tricolore 2 p16** — illustration labels below scan resolution.
- **2 Cosmopolite items** (p85, p201) — `QUESTIONS_COLUMNS` carries only `option_a..c`;
  p85 prints four options, p201 is an image-choice question. A real schema limit.
- **High blank-answer rates** (Cosmopolite 35%, Tricolore 1 45%, Tricolore 2 58%) — all
  three are student coursebooks whose answers live in separate teacher's guides.
  Confirmed against TOC and back matter. `verify_answers.py` now asserts this.

---

## Open work, in the order I'd do it

1. **`instruction` backfill for the 3 finished French books.** Both enrichment prompts
   now capture the exercise rubric, so Saison 2 and Cosmopolite 5 get it free — but the
   finished books need a pass to gain it. **Text-only** (re-reads the `.md`, not the
   images), so it avoids the expensive vision stage. Write to
   `_questions/chunk-*.json`, never the merged file. Add the CSV column only when the
   backfill lands, so all books gain it together and headers stay identical.
   *Measured and rejected:* recovering the rubric mechanically from the page markdown
   hits only 36%/14%/3%, and most "matches" are exercise content, not instructions —
   rubric and content lines are typographically identical. It needs the model.
2. **Saison 2** (215pp) then **Cosmopolite 5** (226pp), one at a time, stop-and-report
   between. Both are pure scans. Both are clean of the colorspace defect.
3. **Legacy French**: finish `conjugaison-a1-a2` QA (37 verdicts), decide whether
   `revision-2` is in scope, and whether either migrates onto `_engine/`.
4. **Drive delivery** — batched until Saison 2 + Cosmopolite 5 are done, per standing
   instruction. Format: `french/extracted/DELIVERY-NOTES.md`.

Sequencing note: doing the backfill **before** Saison 2 gives one consistent schema
across all five French books and one re-upload. Doing Saison 2 first means re-uploading
French twice.

---

## Traps worth carrying forward

- **Disk truth over agent self-reports** — unchanged from v1.0, still the rule.
- **Edit enrichment CHUNKS, never `_questions.json`** for French — the merged file is
  regenerated from chunks and silently erases direct edits. *German is the opposite*:
  it has no chunk files, so `_questions.json` **is** its source of truth.
- **The frozen dance**: flip the 7 Goethe `frozen` flags to `false`, regenerate, flip
  back, then confirm `git diff` on `collections.json` is empty. Done three times this
  session without incident; keep confirming the empty diff every time.
- **A source PDF can lie about its own images.** Tricolore 2 declares `/DeviceRGB` on
  1-channel grayscale JPEGs; MuPDF renders them near-black. Handled automatically now,
  but it is why "the scan is broken" deserves a second look — one of those pages was
  written off as a content-filter gap for months and transcribed fine once re-rendered.
- **Concurrent sessions racing on `_exports/`** — `git checkout --` on generated files
  mid-regeneration is destructive. Re-running the pipeline is the fix; it is idempotent.
