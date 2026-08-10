# Pipeline & Exports Handoff v1.0 — "Tricolore 2 + Cross-Language Taxonomy Fix"

> **SUPERSEDED 2026-08-10 by Pipeline & Exports Handoff v1.1**
> (`_engine/HANDOFF-2026-08-10-pipelines-exports.md`). Read v1.1 first for
> current book status, the verification gates and the standards. This
> document remains accurate as the history of the German run and the
> Tricolore 2 transcription, and for the reasoning behind decisions made
> on 2026-07-28.


**Name:** Pipeline & Exports Handoff
**Version:** v1.0
**Date:** 2026-07-28
**Covers:** the PDF→CSV extraction/enrichment/export side of the project — everything
in this doc is about that, not site design/frontend (see scope note below).

To resume from this handoff in a new chat, reference it as **"Pipeline & Exports
Handoff v1.0"** — bump to v1.1/v2.0 etc. if this doc is revised later so old and new
versions don't get confused.

This covers everything about the **extraction/enrichment/export pipeline and the data
it produces** — the PDF→CSV side of the project. Site design/frontend work (old static
`site/` and new `site-next/`) is being handled in a **separate chat** — don't duplicate
that work here; this doc exists so a fresh chat can pick up the PDF/export/pipeline
side with full context.

## Session log — everything done, in order (nothing omitted)

1. Finished `tricolore-2-5th-edition` transcription end to end: recomputed disk-truth
   repeatedly (never trusted agent self-reports), dispatched/redispatched dozens of
   small-batch and single-page agents to recover from repeated hard content-filter API
   kills, and landed at 180/180 pages with 169 clean + 11 disclosed gaps (see "Known
   issues" #1-3 below for exactly which pages and why).
2. Ran the full enrichment pipeline for `tricolore-2-5th-edition` (classify, questions,
   vocabulary — 6 chunk agents + 1 vocab agent, one connection-drop retry) → merged →
   `build_exports.py` → `package_exports.py`. Result: 2,750 questions (891 answered),
   1,663 vocabulary words.
3. User asked to see this reflected in "the site" — turned out to mean the **old
   static `site/`**, not `site-next/`. Discovered and fixed two real, pre-existing gaps
   while doing this: (a) `tricolore-1-5th-edition` was never added to `site/assets/js/
   data.js` at all despite being finished earlier, (b) French books never had
   `questions`/`words` wired into the KPI row or corpus console anywhere on the site
   (only German did) — both fixed; see "The two site codebases" below for exact files.
4. User separately reported a chart color-fill bug (empty bars, no fill) on a
   "Content types" chart, on **both** `site/` and `site-next/` — confirmed this is
   being fixed in a different chat, explicitly scoped this chat to stay on PDFs only.
5. Re-ran the French export pipeline after a concurrent session's background process
   accidentally `git checkout --`'d 3 regenerated files — confirmed the regeneration
   is fully idempotent, no data lost.
6. User asked whether German's exports have any non-English text that needs
   translating "so others can understand" — audited every taxonomy column across
   every German AND French export. Found German's `section` column used German words
   (`hoeren`/`lesen`/`sprechen`/`schreiben`); fixed across all 10 German collections
   including overriding the 7 frozen/already-delivered Goethe ones (with explicit
   user go-ahead), then found and fixed a second, unrelated bug while auditing French
   (21 `tricolore-2-5th-edition` pages had bogus slugified `section` values). Root-
   caused and fixed both languages' `agent_enrich.md` so this can't recur, and
   documented the standard in the top-level `README.md`.
7. A concurrent session fixed an unrelated real bug in German's `catalog.py`
   (bracket-leakage + bad page titles) and regenerated everything, committing locally
   as `5ac5020`. Verified afterward that both sessions' fixes coexist correctly and
   nothing broke — full CSV/row-count/file-size integrity check across every export
   in both languages came back clean.
8. Wrote this handoff doc + updated the persistent memory index so a fresh chat has
   this full context without needing to be told to read this file specifically.

Everything below is the same information organized by topic instead of chronologically
— use whichever view is more useful.

## What this repo is

`lingotran-engine` extracts structured learning data (transcribed text, practice
questions, vocabulary) from language-textbook PDFs, for German, French, and (not yet
started) Japanese/Portuguese/Romanian/Russian/Spanish. Two coursebook languages are
active: **German** (fully shipped) and **French** (3 of 5 new PDFs done).

## Two separate pipelines — don't confuse them

1. **`_engine/`** (shared, root-level) — used for French's 5 new PDFs
   (`cosmopolite-a1-methode`, `tricolore-1-5th-edition`, `tricolore-2-5th-edition`,
   `saison-2-methode`, `cosmopolite-5-c1c2`). Config: `french/extracted/_tools/collections.json`.
2. **`german/extracted/_tools/`** — German's own bespoke, older pipeline (predates
   `_engine/`). Also used by French's 2 *legacy* books (`conjugaison-a1-a2`,
   `revision-2`) which stayed on this older system by deliberate decision, not migrated
   to `_engine/`.

Both pipelines follow the same conceptual stages, with different script names:

| Stage | `_engine/` (French new PDFs) | `german/extracted/_tools/` |
|---|---|---|
| Rasterize PDF→images | `pdf_to_images.py` | (per-book, ad hoc) |
| Transcribe (agent, per page) | `agent_transcribe.md` | `agent_transcribe.md` |
| Classify + questions (agent, per chunk) | `agent_enrich.md` | `agent_enrich.md` |
| Vocabulary (agent, per chunk) | `agent_vocab.md` | `agent_vocab.md` |
| Merge chunks → `_class.json`/`_questions.json` | `merge_enrich.py` | `merge_enrich.py` |
| Build per-book + global CSVs | `build_exports.py` (does catalog+questions+vocab+combined in one script) | `catalog.py`, `questions.py`, `vocabulary.py` (separate scripts) + `merge_all.py` (global combine) |
| Package deliverable tree | `package_exports.py` | `package_exports.py` |

Invocation pattern for both: `python <tool>.py --root <lang>/extracted <slug> [<slug> ...]`
or `--all` (German only). Re-running any stage is idempotent/safe — same input pages
produce the same output counts every time (verified repeatedly this session).

## Status by book (as of 2026-07-28)

**German — all 10 collections shipped**, 636 pages, 2,830 questions, 3,751 vocabulary
words. 7 of the 10 (`goethe-a1-*`) are marked `"frozen": true` in `collections.json`
— **already delivered to Drive**, and every export script deliberately skips frozen
collections by default (to avoid silently re-touching shipped deliverables). To force a
regeneration of frozen collections: flip `frozen` to `false` in `collections.json`,
run the export script, then flip it back to `true` — always confirm the diff on
`collections.json` ends up empty afterward. 5 of the 10 (the `*-exam-training-*`
booklets) genuinely have **0 vocabulary words** — that's correct, not a gap; they're
pure mock-exam booklets with no dedicated word-list pages to extract from.

**French — 3 of 5 new PDFs done:**
- `cosmopolite-a1-methode` (A1, fixed level) — 224 pages, 203 clean + 21 disclosed
  gaps, 1,751 questions, 1,175 vocab words.
- `tricolore-1-5th-edition` (A1-A2, inferred) — 180 pages, 174 clean + 6 disclosed
  gaps, 2,413 questions, 2,728 vocab words. Was missing from the old static site's
  `data.js` until 2026-07-28 despite being finished earlier — a real, now-fixed gap.
- `tricolore-2-5th-edition` (A2-B1, inferred) — 180 pages, 169 clean + 11 disclosed
  gaps, 2,750 questions, 1,663 vocab words. See "Known issues" below for the gap detail.
- `saison-2-methode` (A2-B1, inferred, Didier) and `cosmopolite-5-c1c2` (C1-C2,
  inferred, Hachette FLE) — **not started at all**, no folders exist yet. Next in the
  **locked one-at-a-time cadence**: recon → folderize → rasterize → transcribe → repair
  → enrich → export → package → site update → commit, stopping to report/ask before
  moving to the next PDF. Never auto-continue through this queue.
- 2 legacy French books on the old `german/extracted/_tools/`-style pipeline:
  `conjugaison-a1-a2` (104/106 pages transcribed, in progress) and `revision-2`
  (0/181 pages, not started).

## Known issues / gaps to be aware of

1. **10 disclosed-gap pages in `tricolore-2-5th-edition`** (167, 168, 170, 171, 173,
   175, 176, 177, 178, 179): every transcription attempt hit a hard content-filter API
   error that terminates the whole agent process (not a soft in-context refusal) —
   confirmed NOT tied to actual sensitive content (directly viewed page 177 myself,
   confirmed ordinary benign GCSE vocabulary; even a plain glossary pair failed
   repeatedly). Looked like session-level flakiness more than a per-page trigger.
   Marked `qa: fail` with the exact failure documented in each `_qa/page-NNN.json`.
   Candidates for a future re-attempt — worth just retrying fresh in a new session
   rather than assuming it's permanently blocked.
2. **Page 16 in `tricolore-2-5th-edition`** — unrelated, pre-existing gap: a few
   unlabeled illustration items on a shopping-trolley image, illegible at source
   resolution. Not a content-filter issue.
3. **Pages 178/179 also have a genuine source-image defect** (confirmed via pixel
   analysis: page 179 is literally white-top/black-bottom with only 3 distinct
   luminance values; page 178 has pervasive speckle noise) — distinct from the
   content-filter issue above, and would need the source PDF re-extracted to fully
   fix (the PDF is not currently present locally, so this is not actionable right now).
4. **Field-naming inconsistency, not yet fixed**: French's per-item exercise-group
   label field is called `part` in `_engine/agent_enrich.md`; German's equivalent is
   called `teil` (German for "part") in `german/extracted/_tools/agent_enrich.md`.
   This is a deliberate-ish inconsistency (German exam papers literally print "Teil 1"
   etc., so keeping the German word there is arguably correct for that field's
   *content*), but the column *name* itself differs across languages. Not fixed this
   session — flagging for a future decision on whether to standardize the CSV schema's
   column names across languages, separate from the taxonomy-*values* fix below.
5. **FIXED this session — 21 pages in `tricolore-2-5th-edition` had a bogus `section`
   frontmatter value**: pages 39-55, 59, 72-73, 104 had slugified chapter/unit-title
   strings (e.g. `module-3-de-jour-en-jour`, `unite-2-on-fait-des-projets`,
   `presse-jeunesse`, `3f-a-mon-avis`) instead of this book's established convention
   of `section: none` throughout. Root cause: a transcription batch ignored the
   documented per-book convention. All 21 corrected to `section: none` and exports
   regenerated. If you see any *other* French book with a `section` value that isn't
   one of `listening|reading|writing|speaking|grammar|vocabulary|none|""`, treat it
   the same way — it's a convention violation, not a new taxonomy value to keep.
6. **A concurrent session fixed a real bug in `german/extracted/_tools/catalog.py`**
   (commit `5ac5020`, local, not yet pushed as of this writing): `content_type` was
   stored verbatim from frontmatter including the `[...]` brackets instead of being
   parsed, and `page_title()` could pick up an HTML comment or a bare "Seite N" line
   as a page's title instead of the real heading. Fixed and re-ran `catalog.py --all`
   → `merge_all.py` → `package_exports.py`, including the same temporarily-unfreeze-
   then-refreeze dance for the 7 Goethe collections. **Verified after the fact (this
   session) that both fixes coexist correctly** — the English `section` values survived
   their catalog.py regeneration, and their bracket-stripping fix is visible in the
   output. Full CSV structural integrity, row counts, and unified `.md` file sizes were
   all re-checked and came back clean across every French + German export after both
   sessions' changes landed. If anything seems inconsistent, re-run the relevant
   export script — every stage in both pipelines is idempotent.

## Standard established this session — read before touching ANY export

**All taxonomy/enum column values must be English, regardless of source language.**
Found and fixed 2026-07-28: German's `section` column used German words
(`hoeren`/`lesen`/`sprechen`/`schreiben`) instead of `listening`/`reading`/`speaking`/
`writing`, across every German book including the 7 frozen/delivered Goethe ones
(fixed with the user's explicit go-ahead to override the frozen protection for this
pure labeling correction — no data/count changes, verified before and after).

- Applies to: `section`, `activity_type`, `content_type`, `topic`, `word_class`,
  `status`, `qa`, `level`, `item_type`.
- Does NOT apply to verbatim/quoted fields — `question` text, answer options,
  examples, printed part/unit labels (these are direct quotes from the book and must
  stay in the source language).
- Full writeup + the "why" is in the repo's top-level `README.md`, under
  "Cross-language export conventions" — read that section before building or fixing
  any language's export pipeline.
- Both `_engine/agent_enrich.md` and `german/extracted/_tools/agent_enrich.md` now
  state this explicitly, cross-referencing each other.
- **Action item for a fresh session**: spot-check any NEW language's first export
  (Saison 2 / Cosmopolite 5 when they start) for stray non-English taxonomy values
  before considering it done — this bug hid for a long time before being caught.

## Where the deliverables live

- Per-book: `<lang>/extracted/<slug>/<slug>-{catalog,questions,vocabulary}.csv` +
  `<slug>.md` (unified full-book transcription).
- Packaged deliverable tree (what actually gets uploaded to Drive):
  `<lang>/extracted/_exports/` — mirrors the per-book files plus `_combined/` (all
  books in one sheet per type) and a `README.md` explaining columns. German's
  `_exports/` is additionally organized by family (`goethe/`, `netzwerk/`, `goyal/`)
  since German has 3 publisher families under one language.
- Drive-share message drafting convention: see `french/extracted/DELIVERY-NOTES.md`
  for the exact tone/format used for prior deliveries (plain English, "what's new,"
  "two things to know," running totals). **Per explicit user instruction, do NOT draft
  or send this until told all current French PDFs (Saison 2 + Cosmopolite 5) are
  done** — don't gate per-book, batch it at the end instead.

## The two site codebases (context only — not this chat's job to edit)

- `site/` — old hand-rolled static HTML/CSS/JS site, data-driven via
  `site/assets/js/data.js`'s `window.LT` object + `render.js`'s attribute-dispatch
  renderer. This session added Tricolore 1+2 to `data.js` (they were previously
  missing) and fixed a real bug: French books never had `questions`/`words` wired
  into the KPI row or corpus console at all (only German did) — now fixed for all
  French books via `french.books[slug].questions`/`.words` fields + `corpus()`'s
  French branch. **No dedicated detail-page HTML exists for Tricolore 1/2** —
  building one means adding 2 more hand-duplicated page folders (the exact
  duplication `site-next` exists to replace) — deliberately not done here.
- `site-next/` — Next.js rebuild of the same site, migration-complete and deployed.
  Design/UX fixes (chart color-fill bug, FidelityCard animation, bento KPI grid,
  etc.) are being handled in a **separate chat** — this chat should not touch
  `site/assets/js/render.js` styling, `site-next/`, or any chart/CSS code. If asked
  to update site *data* (not design) with fresh book stats, that's fine and has
  precedent (see the Tricolore 1+2 addition above) — just stay out of visual/design
  changes.

## Deeper docs to read before starting new work

- `_engine/PLAYBOOK.md` — the standing runbook for `_engine/`: failure modes (vision
  content-safety blocks, the 20-subagent concurrency cap + rolling-dispatch pattern,
  disk-truth recovery after a kill/API error/Plan-Mode interruption), a 5-question
  checklist to run before starting any new book.
- `_engine/EXTRACTION-WORKFLOW.md` — end-to-end walkthrough of the `_engine/` stages.
- `docs/lingotran-engine-e2e-*.md` — an independent code-quality review; P0s fixed,
  some P1s (enrichment-chunk merge precedence, CSV `None`-flattening, zero automated
  tests) still open, worth a glance.
- Recon-confirmed facts for the 2 remaining French PDFs (don't re-guess from
  filenames, but do re-verify against the actual cover/copyright page at the start of
  each book): Saison 2 is **Didier** (not CLE International — an earlier guess was
  wrong), A2→B1 explicitly printed. Cosmopolite 5 is **Hachette FLE**, explicitly
  "C1-C2" printed on the cover.

## Practical lessons from this session worth carrying forward

- **Disk-truth over agent self-reports, always.** Recompute exact page/QA-file
  existence from disk before trusting any status claim, including your own prior
  turns' — this project has hit the same "trust but verify" lesson repeatedly (Plan
  Mode interruptions, killed agents, transient API errors all silently desync
  self-reported progress from reality).
- **A hard content-filter API kill terminates the whole agent process**, unlike a
  soft in-context refusal — no amount of "if blocked, skip and continue" instruction
  helps mid-page, since the agent never gets a chance to react. What DOES help:
  small page batches (1-2 pages per agent) to limit blast radius, and writing
  incrementally (frontmatter first via Write, content via small Edit calls) so
  partial progress survives even when the fatal call does land.
- **`git checkout --` on generated export files is destructive if another session
  is actively regenerating them** — this happened once this session (a background
  process in another chat reverted 3 regenerated files mid-flight). The fix is just
  re-running the export pipeline again (fully idempotent), but it's worth being
  aware that concurrent sessions touching the same `_exports/` tree can race.
