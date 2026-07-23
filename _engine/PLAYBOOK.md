# The Engine Playbook — how we run extraction, every language, from now on

*Distilled from the German A1 corpus run (636 pages, 3 account switches, a 529
API-overload storm, multiple credit resets — zero pages lost) and the honest
cost critique in `german/extracted/ORCHESTRATION-AND-MODELS.md`. This is not a
retrospective — it's the standing operating rule set for every extraction job
this engine runs, starting with French.*

---

## The one rule above every other rule: **zero data loss is non-negotiable**

Everything below exists in service of this. When a new idea (efficiency,
speed, convenience) conflicts with it, zero-data-loss wins, always.

### How we guarantee it (the 5 mechanisms, proven across 636 real pages)

1. **Atomic per-page writes.** Every page's transcription + QA verdict is
   written to its own two files the moment it's done
   (`pages/page-NNN.md` + `pages/_qa/page-NNN.json`). A crash, an account
   switch, a killed agent mid-batch — none of it can corrupt a page that's
   already landed on disk, because nothing is buffered in memory waiting
   for a "batch complete" signal that might never come.
2. **Adversarial QA, not self-grading.** A second, independent pass re-reads
   the source image and the transcription and actively hunts for omissions
   — it may find issues but never silently "trusts" the first pass. An
   author grading its own work rationalizes; an adversarial reader with no
   stake in the first draft actually catches what's missing.
3. **Repair-until-pass, not repair-and-hope.** A failed page goes through a
   repair pass, then gets **re-verified from scratch** against the image —
   never just marked "fixed" on the repairer's say-so.
4. **Disk truth over agent-claimed truth.** Never trust a subagent's summary
   of what it did — recompute "what's actually done" by scanning the
   filesystem (`glob` the `pages/*.md` + `pages/_qa/*.json` that really
   exist) before deciding what to re-queue. This is *the* mechanism that
   made every account switch and session-limit hit a non-event instead of a
   disaster this whole project: resume was never "trust the last message,"
   it was always "recompute from what's on disk right now."
5. **The manifest is a derived cache, never the source of truth.** If
   `manifest-media.tsv` and the real per-page frontmatter ever disagree,
   the frontmatter wins — `sync`/`qa-apply` always re-derive the manifest
   from the pages, never the reverse. This means the manifest can be
   deleted and rebuilt from scratch at any time with zero information loss.

### The verification discipline that catches what mechanisms alone don't

Even with all 5 mechanisms in place, we found two real gaps in the German run
by refusing to declare victory without an explicit final check:
- **A completeness gate before "done."** Before ever reporting 100%, scan
  every page 1..N for *both* files existing *and* the QA verdict reading
  `ok:true` — print the gap list, not just a percentage. This is what
  caught the goyal pages that a killed agent silently dropped (chunk file
  never written, but the batch "looked" complete from the outside).
- **Cross-check delivered numbers against the authoritative export**, not
  against what an agent said it produced. The 2,584→2,830 questions
  correction happened because the actual `*-questions-all.csv` row count
  was checked directly, not because anyone remembered a running total.

---

## The efficiency lessons — apply these by default, don't rediscover them

From the honest cost critique (full detail in
`german/extracted/ORCHESTRATION-AND-MODELS.md`): roughly 80% of the German
run's cost was transcription + QA (vision, unavoidable for real scans), but
**~10% was pure waste** — agents killed mid-work by hitting an exhausted
account/session window, relaunched from scratch. That 10% is avoidable, and
the fixes are cheap to apply going forward:

1. **Check for a text layer before rasterizing anything.** A digital-born
   PDF already contains its text — extract it with plain Python
   (`page.get_text()` style) for free, and only run the expensive vision
   pipeline on pages that are genuine scans. Do this check **first**, per
   collection, before deciding a book even needs the image pipeline.
2. **Small batches, always.** ~5–6 pages per transcription agent. A killed
   agent then costs at most 5–6 pages of rework, not 20–30. This was
   already the working pattern and it's why German recovered cleanly every
   time — keep it as the default, don't scale batch size up "for speed."
3. **One-pass enrichment.** Classify + questions in a single per-range read
   (already how `agent_enrich.md` works) rather than three separate reads
   of the same pages. Vocabulary stays separate only because word-list
   pages are a different, narrower subset of pages, not because it needs
   its own full read of everything.
4. **Right-size effort to page complexity**, not uniformly to "high."
   Covers, tables of contents, and pure word-lists don't need the same
   scrutiny as a dense exercise page — but *never* skip the adversarial QA
   pass itself, only the effort level within it.
5. **Watch the account/session state before launching a wave.** Don't fire
   15–20 expensive agents into a window that's already nearly exhausted —
   that's the single largest source of the "killed mid-work, redo from
   scratch" waste. If a probe agent or two comes back clean, the window has
   headroom; if not, checkpoint-commit what's landed and wait.
6. **Checkpoint-commit on natural boundaries**, not just at the very end.
   Every wave that lands real pages gets folded into git before the next
   wave starts. This is what makes "account got cut off mid-run" a non-event
   instead of lost work — verified repeatedly across the German run.

---

## The shared-engine operating model (locked, applies to every language)

1. **One engine, `--root <lang>/extracted`.** Every tool takes an explicit
   root path, never a hardcoded language name or absolute path baked into
   the file. The language slug and language directory are always *derived*
   from that path (`os.path.basename`/`os.path.dirname`), never re-typed.
2. **`collections.json` is the only place language-specific facts live** —
   title, publisher, source PDF path, level, `level_mode`
   (`fixed` = whole book one level; `inferred` = per-exercise inline level
   tags, for books that mix levels). Code never hardcodes a book's identity.
3. **English-standardized taxonomy across all languages.** `content_type`/
   `activity_type`/`topic` were already English-only; `section` (skill
   category: listening/reading/writing/speaking/grammar/none) now is too,
   with a separate `chapter` field for coursebook chapter/unit identity —
   two different concepts that used to be conflated into one field.
4. **One PDF at a time, confirm-gated.** Finish a book fully — transcribe,
   QA, repair to 100%, enrich, export — before starting the next, and
   **stop and report before moving on**, rather than auto-continuing
   through a queue. This isn't a speed optimization; it's a deliberate
   choice to keep review/course-correction cheap between books.
5. **Exports stay as simple as the job actually needs.** German's
   per-collection + per-family + global 3-tier CSV system was the right
   call for 10 collections across 3 publishers with a delivered, frozen
   subset. It is *not* the default going forward — start with the simplest
   thing that serves the actual ask (e.g. one merged CSV per data type),
   and only add tiers back if a real need shows up. Per-collection sheets
   can still be written to disk as a cheap debug/spot-check artifact
   without being promoted to a "deliverable."
6. **Already-delivered corpora are permanently frozen.** A `frozen: true`
   collection is never re-extracted, never re-enriched, never rewritten by
   any exporter — checked with `git status --porcelain -- <that language>/`
   returning empty as the standing safety gate whenever a new engine run
   touches a language that has prior frozen deliverables.

---

## Before starting any new book, ask these four questions

1. Is there a text layer we can read for free instead of vision-transcribing?
2. What's `level_mode` for this book — fixed or inferred — and is that
   confirmed by actually looking at a few pages, not guessed from the title?
3. Is the account/session window fresh enough to run a real batch, or should
   this wait / start with a small probe first?
4. After this book hits 100%, are we stopping to report before the next one?
   (Yes, always — see engine operating model, point 4.)

If the honest answer to #1 is "yes, it's digital-born" — stop, don't
rasterize, extract the text layer instead. That single check is the biggest
lever available for making the *next* language cheaper than German or French
were.
