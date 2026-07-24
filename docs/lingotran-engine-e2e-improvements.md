# Lingotran Engine — Prioritized Improvement Areas

**Iteration:** 1 · **Date:** 2026-07-23

> What's wrong and why it matters, ranked P0/P1/P2. For the specific fix + verification step for each item, see [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md). For the overall grade and system narrative, see [`lingotran-engine-e2e-review.md`](lingotran-engine-e2e-review.md).

**Priority definitions used below:**
- **P0** — active correctness/data-loss risk, sitting in a path the system already claims to guarantee against exactly this. Fix before the next real extraction run.
- **P1** — real risk, but lower frequency, smaller blast radius, or partially mitigated already. Fix opportunistically, before it bites once.
- **P2** — hygiene, drift, or clarity issues. No active risk; fix when convenient.

---

## P0 — active correctness/data-loss risk

### P0-1: `package_exports.py` destroys the previous deliverable before rebuilding it, non-atomically

**Where:** `_engine/package_exports.py:55-57` (`shutil.rmtree(out)` then `os.makedirs`) and `:102-103` (bare `open(os.path.join(out, 'README.md'), 'w')`).

**Why it matters:** This is the *last* step in the pipeline — the one script whose entire job is producing the tree a content team actually receives. It deletes the whole existing `_exports/` directory up front, then repopulates it file by file with no staging directory and no atomic swap. If the process is killed, a source file goes missing mid-copy (a real TOCTOU risk — `shutil.copy2` is called after an `os.path.exists` check with no guard against the file disappearing in between), or any exception fires between the `rmtree` and the end of `main()`, the result is a partially-populated or **empty** `_exports/` — and the previously-good, already-delivered export tree is simply gone. Every other writer in this codebase is built around "a crash leaves the previous good file untouched"; this one is built around "a crash leaves nothing." It's also the only file in `_engine/` whose own docstring is silent about atomicity while every sibling script explicitly claims it (`build_exports.py:29-30`, `manifest_media.py:14-16`) — this reads as an oversight, not a deliberate scope decision.

**Severity rationale:** Highest possible blast radius (destroys a delivered artifact, not just a re-derivable intermediate) combined with the fact that the whole system is explicitly built around "zero data loss is non-negotiable." This is the single clearest contradiction of that stated rule in the codebase.

### P0-2: `rotate.py` overwrites the source scan image in place, non-atomically, on a routine hot path

**Where:** `_engine/rotate.py:10` — `Image.open(path).rotate(-deg, expand=True).save(path)`.

**Why it matters:** Per `_engine/agent_transcribe.md`'s STEP 1, this runs on essentially every page of every transcription pass — it is not an edge case, it is the normal path. `Image.save()` writes directly to the destination; a process killed mid-save (the exact scenario the atomic-write pattern elsewhere in this codebase exists to defend against) leaves a truncated or corrupted PNG **overwriting the only copy of that page's scan**, with no backup. Recovery means re-rendering from the source PDF via `pdf_to_images.py` — impossible for any collection marked `images_preexisting: true`, since those are by design never re-rasterized. Worse: a corrupted-but-present file still satisfies `reconcile.py`'s `glob('page-*.png')` completeness check (`_engine/reconcile.py:50`), so nothing downstream would ever flag it.

**Severity rationale:** Same class of risk as P0-1 (destructive, non-atomic overwrite of a non-recoverable source) but with much higher frequency (every page, not once per export run), and it's the one risk this whole review found that the system's own detection mechanism (`reconcile.py`) is structurally unable to catch.

### P0-3: The QA-gate boolean check silently accepts a failed page

**Where:** `_engine/reconcile.py:56-61` (`_qa_ok`, specifically `bool(v.get('ok'))` at line 61) and `_engine/manifest_media.py:222` (`ok = bool(v.get('ok'))`) — the identical bug in two independent call sites.

**Why it matters:** Nothing anywhere in the pipeline schema-validates the `_qa/page-NNN.json` an LLM agent writes (`_engine/agent_transcribe.md` specifies `"ok": true/false` as JSON booleans, but this is a prompt instruction, not an enforced contract). If an agent ever emits the JSON **string** `"false"` instead of the boolean `false` — a real, plausible model slip with a schema this informal — Python's `bool("false")` evaluates to `True`, because it's a non-empty string. `reconcile.py` — the tool whose own docstring calls itself "the one check that must pass before calling a collection 100% done" — would report that page as clean. This is the exact class of silent failure the tool exists to prevent, recurring inside the tool itself.

**Severity rationale:** Low probability per page, but it undermines the one gate the entire zero-data-loss story depends on, and the fix is a one-line, zero-risk change in two places — the cost/benefit ratio of leaving it unfixed is bad.

---

## P1 — real risk, smaller blast radius or partially mitigated

### P1-1: Overlapping enrichment chunks resolve silently by alphabetical filename, not recency

**Where:** `_engine/merge_enrich.py:22-23` (`_load_chunks` globs in `sorted()` filename order) + `:37-43` (`merge_class`'s dedup keeps the first-seen page after a stable sort — i.e., whichever chunk's filename sorts first alphabetically).

**Why it matters:** If a corrective re-run of enrichment writes `chunk-25-50.json` to fix a bad original `chunk-1-50.json`, the original still wins for the overlapping pages 25-50, because `'1' < '2'` alphabetically — and nothing prints a warning about the conflict (`_load_chunks`'s only print statement fires on JSON parse failure, not on a duplicate-page collision). `merge_questions` (`:49-56`) has **no dedup at all** for its analogous case — any re-run of a question-enrichment range just doubles the rows, silently, forever.

**Severity rationale:** Requires a specific sequence (a corrective re-run after an initial bad enrichment pass) to trigger, and enrichment is a much lower-volume operation than page transcription — but when it does trigger, it silently ships wrong or duplicated data to the content team with zero signal.

### P1-2: `_flat(None)` turns JSON `null` into the literal string `"None"` in deliverable CSVs

**Where:** `_engine/build_exports.py:55-57` (`_flat`, `' '.join(str(v).split())`), used throughout `build_questions` (`:221-231`) and `build_vocabulary` (`:246-252`).

**Why it matters:** `csv.DictWriter` already converts a Python `None` to an empty cell correctly on its own. Wrapping every field in `_flat()` first defeats that: if any agent-authored field is JSON `null` rather than the instructed `""` (nothing validates this anywhere), `_flat(None)` → `str(None)` → `"None"`, which survives straight into the questions/vocabulary CSVs actually handed to the content team.

**Severity rationale:** Purely a data-quality bug (not a loss/corruption risk), but it ships directly into the deliverable, is trivial to trigger (any agent emitting `null` instead of `""`), and the fix is a one-line change with zero downside.

### P1-3: `reconcile.py`'s "expected page count" comes from disk, not the source PDF

**Where:** `_engine/reconcile.py:48-53` (`_expected_page_count` — `len(glob('images/page-*.png'))`, with no cross-check against the actual PDF page count).

**Why it matters:** If `pdf_to_images.py` crashes partway through rasterizing a book (compounded by the fact that `pdf_to_images.py` itself has no exception handling around the per-page render loop — a single bad page or a killed process aborts the run with whatever's rendered so far left in place), `reconcile.py` treats whatever's already on disk as "expected," and would report the truncated collection as CLEAN once those pages are transcribed — the missing tail is permanently invisible to the one tool built to catch exactly this failure mode.

**Severity rationale:** Requires a crash during rasterization specifically (a narrower window than P0-2's every-page exposure), and is a genuine blind spot in the completeness gate rather than active corruption — real, but one step removed from the P0 tier.

### P1-4: Zero automated regression coverage anywhere in the repo

**Where:** confirmed via repo-wide search — no `test_*.py`/`*.spec.*`, no `pytest.ini`/`conftest.py`/`playwright.config.*`/`jest.config.*`, no `.github/` directory (no CI at all).

**Why it matters:** Every guarantee this system claims — atomic writes, the completeness gate, correct CSV generation — is currently verified only by running the real pipeline against real data and reading the output. `site/UX-AUDIT.md` describes a real, careful Playwright + contrast-math verification pass, but it was a one-time manual session with nothing checked into the repo to rerun it. This isn't a call for a full test suite (see the over-engineering note in the review doc) — it's that the specific bugs found in this review (P0-1 through P1-3) would all have been one small fixture test away from being caught before shipping.

**Severity rationale:** Not itself a bug, but it's why the P0/P1 bugs above went unnoticed — worth fixing precisely because a handful of targeted tests would have prevented this entire findings list.

### P1-5: Documentation actively contradicts the system's real state

**Where:** root `README.md` ("Supported Languages": all 7); `german/README.md` and `german/extracted/README.md` (describe an unfinished "phase 2" web-scrape channel as the mechanism).

**Why it matters:** Root `README.md` lists japanese/portuguese/romanian/russian/spanish as supported; all 5 are empty, untracked folders. `german/README.md` describes German as not yet started on its real pipeline, when in fact German shipped 636 fully QA'd pages months ago (`german/extracted/DELIVERY-NOTES.md`). Anyone — including a future subagent dispatched cold into this repo — reading these files first would build an actively wrong mental model of project state.

**Severity rationale:** No functional/data risk, but directly undermines the project's own "disk truth over agent-claimed truth" philosophy when the *documentation itself* is the thing making the false claim.

---

## P2 — hygiene, drift, and clarity (no active risk)

### P2-1: Dead duplicate script forks under per-language `_tools/`

**Where:** `french/extracted/_tools/rotate.py`/`zoom.py` and German's original `_tools/manifest_media.py`/`pdf_to_images.py` — confirmed genuinely superseded, near-identical ports (only `--root` parameterization + the `_engine/`-only atomic-write and `images_preexisting` additions differ).

**Correction (2026-07-23):** this finding's original wording also named German's `_tools/catalog.py`/`questions.py`/`vocabulary.py`/`merge_all.py`/`package_exports.py` as byte-identical duplicates — that was wrong, caught when actually deleting them. Those 5 files total 447+ lines implementing German's real, shipped 3-tier export structure (global + per-publisher-family + per-collection); `_engine/build_exports.py`/`package_exports.py` are a deliberately *different*, simplified single-tier design (one merged CSV, no family nesting) that cannot reproduce German's actual delivered `_exports/` tree. Those 5 files were kept — they're the only tool that can regenerate German's shipped structure if it's ever needed again, not dead weight.

**Why it matters:** Low risk today because `agent_transcribe.md` hardcodes `_engine/rotate.py`/`_engine/zoom.py` paths, so nothing actually calls the forked copies — but they're dead weight that will silently drift from the canonical version the moment anyone edits one copy and not the other, or greps their way to the wrong file.

### P2-2: An orphan, fully-verified dataset invisible to the whole tracking system

**Where:** `german/extracted/deutsch-pruefung/` — 113 web-scraped pages, own `manifest.tsv`, all `verified/pass`, but registered in **none** of `collections.json`, `_exports/`, `reconcile.py`, or `DELIVERY-NOTES.md`'s totals.

**Why it matters:** It's real, complete, good data — just structurally invisible to every tool and report this review otherwise relies on as ground truth. Not urgent, but worth a decision (fold it into `collections.json` as its own entry, or explicitly document it as a separate, permanently-out-of-band channel).

### P2-3: French's new-collection manifest is already stale relative to actual page state

**Where:** `french/extracted/manifest-media.tsv` currently shows all 224 `cosmopolite-a1-methode` rows as `status: pending`, while `page-001.md`/`page-002.md` are already `verified` on disk.

**Why it matters:** This is not a bug — it's the system's own documented design ("the manifest is a derived cache, never source of truth") caught in the act, mid-run, before anyone has called `manifest_media.py sync`. Flagged here only so it isn't mistaken for a new finding; the fix is operational (run `sync`), not a code change.

### P2-4: French's two-schema split is a known, already-decided limitation, not an open question

**Where:** the legacy `manifest.tsv`-based system for `conjugaison-a1-a2`/`revision-2` (stalled ~1 month, 16 pages in unresolved `qa: fail`) versus the new `collections.json`-based system for 5 newer books — explicitly documented as a "locked decision" in `french/extracted/_tools/collections.json`'s own comments.

**Why it matters:** Named here for completeness of the state picture, not as something this review is proposing to change. The practical consequence worth being aware of: the legacy corpus has no path to `reconcile.py` coverage as things stand, so its stalled/failed pages will not surface in any future completeness sweep unless someone explicitly revisits the locked decision.
