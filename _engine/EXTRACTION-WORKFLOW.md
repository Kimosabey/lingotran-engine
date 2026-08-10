# Extraction Workflow — end to end, for anyone cloning this repo

This is the **linear, do-this-then-that** guide to running an extraction with
`_engine/`, from a source PDF to a clean CSV/Markdown deliverable. If you just
cloned the repo and want to extract a new book, start here.

- **The contract & tool reference** → [`README.md`](README.md) (what each tool
  is, the `--root` convention, the schema).
- **The *why* — hard-won rules, failure modes, cost lessons** →
  [`PLAYBOOK.md`](PLAYBOOK.md). Read it before your first real run; it will
  save you money and lost work.
- **This file** → the ordered procedure with real commands.

---

## 0. The single most important thing to understand first

**This pipeline is half deterministic Python, half LLM-agent work. They are
run differently.**

| Kind | Steps | How you run them |
|---|---|---|
| **Python tools** (deterministic) | rasterize, seed manifest, merge chunks, reconcile, verify answers, build/package exports | `python _engine/<tool>.py --root <lang>/extracted ...` — plain CLI commands. |
| **LLM-agent steps** (vision / language) | transcribe, adversarial QA, classify, extract questions, extract vocabulary | **NOT a script.** You dispatch a subagent (Claude Code or any capable agent harness) using the `_engine/agent_*.md` prompt templates, one small page-range batch at a time. There is no `python transcribe.py`. |

The `agent_*.md` files are **prompt templates**, not programs. You (the
orchestrator — a human, or an agent driving other agents) fill in a small
"Parameters for this run" block at the top (which book, which pages, which
level) and hand the whole thing to a subagent that can read the page images
and write files. The agent writes its output straight to disk (atomic
per-page files); the Python tools then assemble and check that output.

If your harness can't dispatch vision-capable subagents, you can still run
every Python step, but you'll have to do the transcription/enrichment reads
by hand. The design assumes an agent harness for those four steps.

---

## 1. Prerequisites & setup

- **Python 3.10+** (developed on 3.12).
- Two libraries: **PyMuPDF** (`fitz`, the rasterizer) and **Pillow** (`PIL`,
  image rotate/crop). Everything else is the Python standard library.

```bash
pip install PyMuPDF Pillow
```

Confirm the tools import and the test suite is green before you trust a run:

```bash
python -c "import fitz, PIL; print('ok')"
python -m unittest discover -s _engine/tests    # should end in OK
```

No build step, no server, no database. The "state" of a job is just files on
disk under `<lang>/extracted/<slug>/`.

---

## 2. The on-disk layout of one collection

Everything for one book lives under `<lang>/extracted/<slug>/`. After a full
run it looks like this:

```
french/extracted/tricolore-1-5th-edition/
  images/
    page-001.png … page-180.png          # rasterized source (gitignored, heavy)
  pages/
    page-001.md … page-180.md            # transcription, one atomic file per page
    _qa/
      page-001.json … page-180.json      # adversarial QA verdict per page  {ok, missing_count, issues}
    _class/
      chunk-001-030.json …               # classification, written by enrich agents in chunks
    _class.json                          # merged classification (derived from _class/ by merge_enrich.py)
    _questions/
      chunk-001-030.json …               # questions, written by enrich agents in chunks
    _questions.json                      # merged questions (derived — DO NOT hand-edit; see PLAYBOOK)
    _vocab/
      chunk-*.json                        # vocabulary chunks
  tricolore-1-5th-edition.md             # unified book doc (build_exports.py)
  tricolore-1-5th-edition-catalog.csv    # per-book CSVs (build_exports.py)
  tricolore-1-5th-edition-questions.csv
  tricolore-1-5th-edition-vocabulary.csv
```

Key rule from [`PLAYBOOK.md`](PLAYBOOK.md): the `chunk-*.json` files are the
**source of truth**; `_class.json` / `_questions.json` are **derived** by
`merge_enrich.py`. Never hand-edit the merged files — the next merge silently
regenerates them from the chunks and erases your edit. Fix the chunk instead.

The language-level roll-ups (`<lang>-{catalog,questions,vocabulary}-all.csv`)
land in `<lang>/extracted/`, and the clean deliverable in
`<lang>/extracted/_exports/` (see step 11).

---

## 3. The end-to-end runbook

Each book goes through these steps in order. Steps marked **[py]** are Python
commands; steps marked **[agent]** are subagent dispatches.

### Step 1 — Recon (before you commit anything) [agent or manual]

Open a few pages of the PDF (cover, copyright/title, table of contents, a
couple of content pages, and the back matter). Confirm, by *looking*, not
guessing from the filename:

- **Publisher, title, edition.**
- **Level, and `level_mode`** — is the whole book one CEFR level (`fixed`),
  or does difficulty span levels so each exercise needs its own tag
  (`inferred`)? Look at early *and* late pages.
- **Answer keys — printed or not?** Check the TOC and back matter for an
  "Answers / Corrigés / Solutions" section. A student coursebook usually has
  none (answers are in a separate teacher's guide) → expect many blank
  `correct_answer` fields, which is correct, not a gap. Record this.
- **Is it digital-born (has a text layer)?** If yes, you may not need the
  vision pipeline at all — see PLAYBOOK efficiency lesson #1.

A cheap way to sample pages without rasterizing the whole book:

```bash
python -c "import fitz; d=fitz.open('french/pdf/.../book.pdf'); \
[d.load_page(i).get_pixmap(dpi=140).save('/tmp/recon-%03d.png'%(i+1)) for i in [0,1,4,40,150]]"
```

### Step 2 — Write the `collections.json` entry [manual]

In `<lang>/extracted/_tools/collections.json`, add one entry:

```json
{
  "slug": "tricolore-1-5th-edition",
  "family": "oxford-university-press",
  "title": "Tricolore 1 - 5e edition",
  "level": "A1-A2",
  "level_mode": "inferred",
  "level_options": ["A1", "A2"],
  "pdf": "pdf/oxford-university-press/tricolore-1-5th-edition/tricolore-1-5th-edition.pdf",
  "book_type": "student-coursebook",
  "answer_key": {
    "status": "separate-guide",
    "checked": "what you looked at during recon",
    "note": "why blanks are expected"
  }
}
```

`pdf` is relative to the **language folder** (`french/`), not `extracted/`.
Lay the PDF out at `<lang>/pdf/<publisher>/<variant>/<file>.pdf`.

### Step 3 — Rasterize [py]

```bash
python _engine/pdf_to_images.py --root french/extracted tricolore-1-5th-edition
```

Renders `images/page-NNN.png` at 300 DPI. (A collection with
`"images_preexisting": true` is skipped, by design.)

### Step 4 — Seed the manifest [py]

```bash
python _engine/manifest_media.py --root french/extracted init
```

Creates the resume-anchor TSV + dashboard. Remember: the manifest is a
*derived cache* — if it ever disagrees with the per-page files, the files win.

### Step 5 — Transcribe + adversarial QA, in small batches [agent]

For each batch of **~5–6 pages**, dispatch a subagent with
`_engine/agent_transcribe.md`, filling its parameters block (BASE, LANGUAGE,
LEVEL, LEVEL_MODE, LEVEL_OPTIONS, the page range). The agent:

- reads each page image, writes `pages/page-NNN.md` (atomic),
- runs an **independent** adversarial QA pass, writes `pages/_qa/page-NNN.json`.

Run many batches concurrently (rolling dispatch — keep the concurrency slots
full, refill each as it completes; cap is currently 20). Small batches mean a
killed agent costs at most a few pages of rework. See PLAYBOOK "New failure
modes" for content-safety handling and disk-truth recovery.

### Step 6 — Reconcile transcription to 100% [py]

```bash
python _engine/manifest_media.py --root french/extracted qa-apply
python _engine/reconcile.py --root french/extracted tricolore-1-5th-edition
```

`reconcile.py` scans disk (not agent claims) for every page 1..N having both
files and a `ok:true` QA verdict. A non-zero exit means **stop and fix** —
re-dispatch only the truly missing pages (recompute from disk). Repeat 5→6
until it reports `CLEAN`. A genuinely unfixable page (scan-resolution or
content-safety limit, individually reviewed) can be listed in the collection's
`accepted_qa_gaps` so it stops blocking CLEAN while staying visible — never
for a page that was never attempted.

### Step 7 — Enrich: classify + questions + vocabulary [agent]

Dispatch `_engine/agent_enrich.md` (classification + questions in one read)
and `_engine/agent_vocab.md` (vocabulary) per page range. Agents write
`_class/chunk-*.json`, `_questions/chunk-*.json`, `_vocab/chunk-*.json`. For
an `inferred` book, every question item must carry a per-item `level` from
`level_options` — the transcription's inline `**[A1 (inferred)]**` tags are
where that comes from.

### Step 8 — Merge the chunks [py]

```bash
python _engine/merge_enrich.py --root french/extracted tricolore-1-5th-edition
```

Assembles the chunk files into `_class.json` / `_questions.json`
(mtime-ordered, last-write-wins, cross-chunk duplicates flagged).

### Step 9 — Verify answers + level tags [py]

```bash
python _engine/verify_answers.py --root french/extracted tricolore-1-5th-edition
```

Auto-fixes the one mechanical case (bare-letter MC → full option text);
reports (never guesses) everything needing a human read, **and** enforces the
inferred-level contract (flags items missing a `level` or outside
`level_options`). Fix flagged items in the **chunk** files, then re-run step 8,
then this, until clean.

### Step 10 — Build exports [py]

```bash
python _engine/build_exports.py --root french/extracted tricolore-1-5th-edition
```

Writes the per-book unified `.md` + per-book CSVs, and rebuilds the merged
`<lang>-{catalog,questions,vocabulary}-all.csv` across every non-frozen book.

### Step 11 — Package the deliverable [py]

```bash
python _engine/package_exports.py --root french/extracted
```

Assembles the clean `_exports/` tree: `README.md` + `START-HERE.md` +
`_combined/` (roll-ups) + one folder per book (its CSVs + `.md`). In-place,
atomic per file, prunes stale files — safe to re-run.

The two loose docs are the only files allowed at the top, and they do different
jobs: `README.md` is the reference (column lists, row counts, known
limitations), `START-HERE.md` is the content team's entry point — a "what do I
open?" page. **`START-HERE.md` is generated for every language** by the shared
builder in `_engine/_common.py`, from the real per-book counts collected during
packaging, so it cannot drift from what actually shipped and every language's
deliverable has the same shape. Don't hand-edit it. If a language genuinely
needs bespoke wording, write `<root>/_tools/START-HERE.source.md` and that file
is copied in verbatim instead.

### Step 11b — Verify the deliverable [py]

```bash
python _engine/verify_exports.py --root french/extracted
```

The last gate before anything leaves the repo, and the only one that reads the
CSVs a recipient actually opens. Non-zero exit = do not deliver. Checks:

- **schema** — column names are English and identical across languages for the
  same sheet, in canonical order (this is what `teil` vs `part` violated);
- **taxonomy** — closed enums (`section`, `item_type`, `word_class`, `status`,
  `qa`, `level`) hold only documented values, and **no taxonomy value contains
  a non-ASCII letter in any language** — the generic form of German's
  `section: hoeren`, which works unchanged for Japanese, Russian or Arabic;
- **cell hygiene** — no HTML comments/entities, mojibake, embedded newlines,
  control characters or ragged whitespace in human-read columns;
- **structure** — every file parses, no ragged rows, no header-only files;
- **references** — every `source_page` exists in that book's catalog;
- **packaging** — each packaged file still matches its per-book source.

Open vocabularies (`content_type`, `activity_type`, `topic`) are *reported* as
drift rather than failed, since genuinely new categories are expected — but
review the list, that is how `defective-image` reached a shipped catalog.

### Step 12 — Safety check, commit, report [py]

```bash
git status --porcelain -- german/     # MUST be empty — frozen corpora untouched
```

Commit the book (feature-scoped), then **stop and report** before the next
book. Delivery (Drive upload + notify) happens here; see a language's
`DELIVERY-NOTES.md` for the format.

---

## 4. The verification gates (don't declare "done" without all of these)

1. `reconcile.py` reports `CLEAN` (every page has both files + `ok:true`).
2. `verify_answers.py` — no un-triaged flags; for inferred books, no
   missing/invalid level tags.
3. Row counts in the delivered CSVs match the source (row-count reconciliation
   is built into `build_exports.py`/`package_exports.py`; a `!! MISMATCH`
   line means stop).
4. `verify_exports.py` reports `exports are clean and deliverable` (schema,
   taxonomy, cell hygiene, page references, packaging drift). The first three
   gates all pass on a book whose CSVs are unreadable — this is the one that
   looks at what the recipient sees.
5. `git status --porcelain -- <frozen-lang>/` is empty.

And two gates that run *earlier* than "done", where they still save money:

- **After rasterizing, before dispatching any transcription agent**,
  `pdf_to_images.py` screens every page for blank/degenerate images and prints
  what it found (re-runnable alone via `--audit`). Vision is ~80% of spend, so
  a page with nothing on it is the most expensive thing to hand an agent — and
  it comes back as a "gap" that costs more cycles to diagnose. Review the list
  and record genuine blanks as `accepted_qa_gaps` instead of transcribing them.
- **`reconcile.py` refuses to call a fully-transcribed book CLEAN** until its
  `collections.json` entry carries `book_type`, `answer_key.status`, `caveats`
  and `accepted_qa_gaps`. Use `[]` for the two lists when a book genuinely has
  none — absent means "never asked", `[]` means "reviewed, there are none".
  Without this a book ships with no "Known limitations" section at all.
  `verify_answers.py` additionally cross-checks the blank-answer rate against
  the declared `answer_key.status`, so "printed" plus 58% blanks is caught.

---

## 5. Onboarding a brand-new language

1. `mkdir -p <language>/extracted/_tools` and write `collections.json`
   (top-level `language`/`language_code` + one entry per book).
2. Lay PDFs at `<language>/pdf/<publisher>/<variant>/<file>.pdf`.
3. Run the runbook above with `--root <language>/extracted`.

Nothing in `_engine/*.py` should need to change. If it does, the change
belongs to *every* language — that's a signal you're about to special-case
something that shouldn't be. The section taxonomy
(`listening|reading|writing|speaking|grammar|none` + a separate `chapter`
field) is English across all languages.

---

## 6. Safety invariants (non-negotiable)

- **Zero data loss.** Every writer uses atomic file writes; every resume
  recomputes from disk, never from an agent's self-report. See PLAYBOOK §
  "zero data loss."
- **Frozen corpora are frozen.** Never invoke any `_engine/*` command with a
  `--root` pointing at a delivered/frozen language, and never edit under it.
  `git status --porcelain -- <that-lang>/` empty is the standing gate.
- **Never hand-edit derived files** (`_class.json`, `_questions.json`,
  `manifest-media.tsv`) — edit the source chunks/pages and re-derive.
