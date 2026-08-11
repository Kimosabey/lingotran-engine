# Pipeline & Exports Handoff v1.1 — "Rubrics, Translations, and Gap Closure"

**Name:** Pipeline & Exports Handoff
**Version:** v1.1 (supersedes v1.0, `HANDOFF-2026-07-28-pipelines-exports.md`)
**Date:** 2026-08-10
**Covers:** the PDF→CSV extraction/enrichment/export side only. Site design/frontend
(`site/`, `site-next/`) is owned by a different chat — updating site *data* is fine and
has precedent.

To resume, reference this as **"Pipeline & Exports Handoff v1.1"**. v1.0 stays accurate
only as history of the German run and the Tricolore 2 transcription; this document
supersedes it for current state, gates and standards.

Everything below is verified from disk, not from memory.

## Branching — changed 2026-08-11

| Ref | Role |
|---|---|
| **`develop`** | Where work happens. Commit here. |
| **`main`** | **Production.** Vercel builds it. Promoted deliberately, never auto-forwarded. |
| annotated tags | The only thing that pins a version. `v1.0.0`, then `v1.1.1`…`v1.1.6`. |

**Do not create `lingotran-engine-vX.Y.Z` branches.** A branch named for a version
lies the moment it moves: `v1.1.0` ran 14 commits past its own `v1.1.0-handoff` tag
while carrying six later tags, and the day before it moved 41 times pinning nothing.
`lingotran-engine-v1.0.0` sat 96 commits behind `main` still advertising itself as a
maintained v1.0 line; its position is now the tag `v1.0.0` and the branch is deleted.
`lingotran-engine-v1.1.0` survives only until the frontend session moves off it.

`main` used to be fast-forwarded after every commit, which made it a second name for
the working branch and bought nothing — and because Vercel deploys it, that is how a
half-finished frontend refactor reached production on 2026-08-11. Promote on purpose.

This header deliberately carries no commit counts or tag totals. The two previous
versions of it went stale within the hour, once while claiming `main` was level when
it was 82 behind. Run `git log --oneline -1` and `git tag -n1`; do not trust a number
written in a document.

---

## 1. Where things stand

| Language | Books | Pages | Questions | Vocabulary | State |
|---|---|---|---|---|---|
| German | 10 | 636 | 2,830 | 3,751 | **Delivered**, on Drive |
| French | 3 of 6 registered | 584 | 6,914 | 5,566 | **Delivered**, on Drive |

**Data quality, measured:**
- **Rubrics** (`instruction`): 9,650 of 9,744 items (99.0%). German 100%, French 98.6%.
  The 94 blanks are groups where the book prints no rubric at all.
- **Translations** (`translation`): 4,303 of 4,391 entries in the two BILINGUAL books
  (98.0%). Cosmopolite is 0% and correct — it is monolingual and prints no gloss.
  German is 0% for the same reason and deliberately has no such column.

**Both languages need a re-upload** — the Drive copies predate `instruction`,
`translation`, `gender` and `option_d`/`option_e`. Upload from tag
`v1.1.0-workflow-gaps-closed` (or later). The deliverable now stamps its own commit into
`START-HERE.md`, so a Drive folder identifies the extraction that produced it.

### Not started

| Book | Pages | Note |
|---|---|---|
| `saison-2-methode` | 215 | Didier A2→B1. Pure scan, no text layer. |
| `cosmopolite-5-c1c2` | 226 | Hachette C1–C2. Pure scan, denser. |
| `reussir-delf-prim-a1` | 71 | **Blocked on a decision** — see §6. |
| `conjugaison-a1-a2` | 106 | Legacy pipeline. 104 transcribed, only 67 QA'd. |
| `revision-2` | 181 | Legacy pipeline. 0 transcribed. |

The two legacy books are now registered with `pipeline: legacy-manifest`: `reconcile.py`
reports them loudly but does not gate on them, and they are excluded from the
deliverable. They used to be in no config at all, which read as "done" by omission.

---

## 2. The gates — run all of these, in this order

| When | Command | Catches |
|---|---|---|
| after rasterizing | `pdf_to_images.py --root <lang>/extracted --audit --all` | blank / degenerate page images, **before** vision spend |
| after a wave | `reconcile.py --root <lang>/extracted --all` | missing pages/QA, classification holes, incomplete `collections.json` |
| answers, delivered books | `verify_answers.py --root german/extracted --all --dry-run --strict` | same checks, **writes nothing** — mandatory for any book already shipped |
| after merge | `verify_answers.py --root <lang>/extracted --all --strict` | answer shape, level tags, answer-key rate vs declared status |
| after a backfill | `verify_backfill.py --root <lang>/extracted --field <name>` | records lost, or ANY field changed besides the intended one |
| before delivery | `verify_exports.py --root <lang>/extracted` | schema, taxonomy, cell hygiene, **coverage**, page refs, packaging drift |
| before delivery | `check_exports_current.py --root french/extracted` | exports stale relative to their sources |
| always | `python -m unittest discover -s _engine/tests` (131) and `-s german/extracted/_tools/tests` (13) | regressions |

CI runs all of these on every push — **nine steps, both languages** since 2026-08-11.
A non-zero exit is a hard stop. Until then it ran the French gates only, so ten delivered
German books were checked for export shape and nothing else; the first run that pointed
`reconcile` and `verify_answers` at German failed on both.

**Two of these exist because something shipped wrong.** `verify_exports`' coverage check
exists because a German export went out at 8.7% rubric coverage while passing every other
gate — the gates validated *shape*, not *fullness*. `check_exports_current` exists because
nothing could tell that a committed export no longer matched its sources.

---

## 3. Standards (cumulative)

1. **Taxonomy VALUES are English** in every language. Enforced generically: no taxonomy
   value may contain a non-ASCII letter, so it works for Japanese or Arabic untaught.
2. **Column NAMES are English and identical across languages.** `teil` → `part` was the
   last violation, now renamed at source (5,413 records) with the shim deleted.
3. **`level` is a bare enum** — `A2`, never `A2 (inferred)`, never `A2+B1` (use `mixed`).
4. **`content_type` is a CLOSED list of 28 values.** Don't coin synonyms.
5. **A finished book declares** `book_type`, `answer_key.status`, `caveats`,
   `accepted_qa_gaps`, and `expect_coverage`. `[]` = reviewed-and-none; absent = never asked.
6. **No empty deliverable files, and no permanently-empty columns.** A booklet with no
   questions gets no questions CSV; German gets no `translation` column.
7. **Verbatim means verbatim.** `"Met les mots dans le bon ordre."` keeps the book's typo.
   Nothing is translated or invented on a book's behalf.

---

## 4. The rule that destroys work if you get it backwards

**The source of truth is the CHUNKS.** Edit `pages/_questions/chunk-*.json`, never
`pages/_questions.json` — the merged file is regenerated and direct edits vanish silently.

This used to differ per book (German's five Goethe books had no chunk directory). Closed
on 2026-08-10 by giving them one, so the rule now has **no exceptions**.

The same rule in the other direction, which has bitten both ways:
- A tool that WRITES a derived file must not leave state the source lacks.
  `verify_answers` once persisted fixes only to the merged file; 52 items disagreed
  between chunk and merged before it was caught. It now writes back into the chunks.
- After editing chunks you **must run `merge_enrich.py` before exporting**. Skipping it
  produced the 8.7% export.

---

## 5. Known gaps — §6 of `EXTRACTION-WORKFLOW.md`

**15 of 20 closed on 2026-08-10.** Closed rows are struck through and annotated rather
than deleted: why a control exists is worth more than a tidy list.

**5 remain open, none quick:**

| Gap | Why it is still open |
|---|---|
| **P1** German fork | A real migration — 4 scripts, 10 delivered books, 7 frozen. Wants its own session with byte-identical output proof at each step. Blocks `check_exports_current` for German. |
| **P5** Vocabulary covers only word-list pages (5–19% of a coursebook) | Not a code change: a new extraction mode plus agent runs over 1,200+ pages, output kept in its own sheet so curated data is not diluted. |
| **P10** Non-Latin scripts untested | **Genuinely blocked** — cannot be validated without a real CJK or RTL book. Generic guards are in place; the rest is unknown until one arrives. |
| **A1** No orchestrator in-repo | A build, not a fix. Would dispatch from `reconcile` gaps instead of by hand. |
| **A6** Concurrency cap with no queue | Real infrastructure; the rolling-dispatch pattern works today. |

---

## 6. Open work, in the order I would do it

**Updated 2026-08-11, end of session.** The Drive re-upload is DONE, from
`v1.1.9` / commit `9bd75bd` — recorded in both `DELIVERY-NOTES.md` files. P1 is
closed: German runs the shared exporter, the four forked scripts are deleted, and
`check_exports_current` covers German in CI for the first time.

Next, in order:

1. **DELF Prim decision** and **Legacy French decision** — the only two things
   blocking on a human. Recommendation on record: source a complete DELF Prim
   copy rather than process a book whose entire A1 mock exam is missing, and
   formally park both legacy books (`revision-2` is 0/181; `conjugaison-a1-a2`
   needs a QA pass *and* an engine migration for one conjugation workbook).
2. **Stage 2 — the 221 unresolvable matching answers.** 140 French + 81 German
   rows whose `correct_answer` is a bare letter with no options on the row, so a
   reader cannot resolve it. Measured: only 15 of 221 are recoverable from the
   existing transcriptions, so this is a targeted vision re-read of **83 pages**
   (63 FR + 20 DE), then map letter → option text as was done for the German 41.
   11 of the German rows sit in frozen books and need an explicit unfreeze.
   Cheaper now than after two more books add their own matching exercises.
3. **Saison 2** (215pp), then **Cosmopolite 5** (226pp), stop-and-report between.
4. Retire `lingotran-engine-v1.1.0` once the frontend session moves to `develop`.

### Original queue, for context

1. **Re-upload both languages** to Drive (user action). French 12 CSV + 5 MD, German
   35 CSV + 12 MD.
2. **DELF Prim decision** — the PDF is missing ~20 printed pages including the entire A1
   mock-exam section (its own Sommaire runs to p93; the file stops at p75). Source a
   complete copy, or process this one with the truncation disclosed? Nothing starts
   until this is answered.
3. **Legacy French decision** — finish `conjugaison-a1-a2`, migrate it onto `_engine/`,
   or formally park it? `revision-2` is 0/181, so "park" is the likely honest answer.
4. **Saison 2** (215pp) then **Cosmopolite 5** (226pp), one at a time, stop-and-report
   between. Both are pure scans; both are clean of the colorspace defect.
5. **P1** — collapse the German fork, which then unblocks the staleness check for German.
6. **Drive delivery message** — batched until Saison 2 + Cosmopolite 5 are done, per
   standing instruction. Format: `french/extracted/DELIVERY-NOTES.md`.

---

## 7. Traps worth carrying forward

- **Disk truth over agent self-reports.** Now a shipped tool, `verify_backfill.py`, not a
  habit. Every wave this session was checked against `git HEAD`; it found zero drift, but
  only because it was run.
- **A source PDF can lie about its own images.** Tricolore 2 declares `/DeviceRGB` on
  1-channel grayscale JPEGs; MuPDF rendered them near-black. One page was written off as
  a permanent content-filter gap for weeks and transcribed fine once re-rendered.
  `pdf_to_images.py` detects and repairs this now.
- **The frozen dance is automated** — `german/extracted/_tools/regenerate_frozen.py`
  restores the config in a `finally` block and verifies it byte-for-byte. Do not do it by
  hand again.
- **German's `merge_enrich.py` takes explicit slugs**, not `--all`; it will treat `--all`
  as a collection name.
- **Brief agents to read a completed chunk first** and match its convention, and to
  **write each file as they finish it**. Both are now in the prompts. The second is why an
  interrupted run loses one chunk instead of a whole wave.
- **Concurrent sessions race on `_exports/`.** Also: `git add -A` in this repo will sweep
  in another chat's in-flight site work — stage explicit paths. This has now happened
  three times; `954dbab` is the worst of them, a `fix(ci):` commit carrying 29 unrelated
  files including the entire deletion of `site/`, and it is pushed.
- **A derived file that differs by platform defeats every byte-level check.**
  `csv.DictWriter` emits CRLF on all platforms (RFC 4180); with no `.gitattributes`,
  a Linux checkout was LF, so every French CSV read STALE in CI and current on Windows
  for eleven consecutive runs. Reproducing on the same OS cannot surface an OS
  difference — the clean-clone run that "passed all eight steps" was Windows.
  Line endings are now pinned in `.gitattributes`; `atomic_write_text` writes LF
  everywhere. **Never compare derived files line-by-line to dodge this**: `splitlines()`
  discards line endings and briefly turned CI green with the defect fully intact.
- **`verify_answers.py` WRITES.** Despite the name it is a repair pass, normalising
  `correct_answer` in place. Running it on German "just to check the gate" rewrote 7
  files across two delivered books, and the second run then reported `0 auto-fixed`
  because the mutation had already landed — the summary looked innocent exactly when it
  should have looked alarming. **Use `--dry-run`** (added 2026-08-11, `v1.1.2`), which
  is what CI uses for German. Still check `git status` after any non-dry run.
- **German's exporters TRUNCATE the per-family sheet to the slugs you pass.**
  `catalog.py` / `questions.py` / `vocabulary.py` build `<family>-a1-*-all.csv` from only
  their arguments and then overwrite it. The workflow doc shows `catalog.py <slug>`
  singular, so rebuilding a two-book family one book at a time leaves the sheet holding
  just the last one — on 2026-08-11 that silently dropped the globals to 580 / 2415 /
  3653 from 636 / 2830 / 3751, losing the entire test booklet. **Pass every slug in the
  family in one invocation.** Nothing gated it: every exporter reported success, and it
  was caught only by comparing against known totals. A bare `--all` is not the fix
  either — frozen collections are skipped, so `--all` would write the goethe family
  sheet empty.
- **German's tooling writes platform-dependent `.md`** (CRLF on Windows), unlike
  `_engine`, whose `atomic_write_text` now pins LF. Harmless today only because
  `check_exports_current` is not wired for German — and it is one more reason it cannot
  be until P1 lands.
