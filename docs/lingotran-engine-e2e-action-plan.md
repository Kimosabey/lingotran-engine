# Lingotran Engine — E2E Action Plan

**Iteration:** 1 · **Date:** 2026-07-23 · **Status: recommendations only — nothing in this iteration has been implemented yet.**

> One actionable item per finding in [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md). Each item names the specific minimal change, its effort, and how to verify it worked. All fixes reuse patterns already present in this codebase (the `_common.py` atomic-write pattern, existing print-based warnings) — none introduce a new abstraction, dependency, or framework.

---

## P0 — do before the next real extraction run

### Action P0-1: Stage-then-swap `_exports/`, and route `README.md` through the atomic helper

**File:** `_engine/package_exports.py`

**Change:**
1. Build into a sibling staging directory (e.g. `_exports.tmp`) instead of wiping `out` in place — same technique `_common.atomic_open` already uses for files, just applied at the directory level: build fully into the temp dir, then `os.replace(tmp_dir, out)` once everything has succeeded. `os.replace` on a directory is atomic on POSIX; on Windows it requires the destination not exist as a non-empty dir in older APIs, but Python's `os.replace` (unlike `os.rename`) handles this correctly on both platforms for directories the same user process owns — this is exactly the same guarantee `_common.py` already relies on for files, just one level up.
2. Change the `README.md` write (currently `with open(os.path.join(out, 'README.md'), 'w', encoding='utf-8') as f: f.write(...)`) to `atomic_write_text(...)`, importing it from `_common` alongside the existing `parse_root, lang_slug, load_collection_list` import.

**Effort:** Small (one function restructured, one import added, one line swapped).

**Verification:**
- Run `python _engine/package_exports.py --root french/extracted` twice in a row on real data and confirm identical output both times (idempotence preserved).
- Simulate a crash: kill the process (or raise a forced exception) partway through a rebuild and confirm the *previous* `_exports/` tree is still intact and complete afterward — this is the actual guarantee being added, so it should be checked directly, not assumed from reading the diff.
- Confirm `_exports/README.md` is regenerated correctly and the whole tree still passes a manual spot-check against `package_exports.py`'s own printed summary (combined sheet count, book count, CSV+MD totals).

### Action P0-2: Make `rotate.py`'s image overwrite atomic

**File:** `_engine/rotate.py`

**Change:** Write the rotated image to a temp file in the same directory as `path`, then `os.replace(tmp_path, path)` — the same pattern `_common.py` already implements for text, just needed here for binary/image data. Simplest form: use `tempfile.mkstemp(dir=os.path.dirname(path), suffix='.png')`, `Image.save(tmp_path)`, close, `os.replace(tmp_path, path)`, with the temp file cleaned up on any exception. This can be a small local helper in `rotate.py` itself, or (slightly better, since `zoom.py`'s output is lower-risk but the same binary-write gap exists there too) a shared `atomic_save_image(img, path)` added to `_common.py` that both `rotate.py` and (optionally) `pdf_to_images.py` can reuse — pick whichever keeps the diff smaller; either is a small change, not a redesign.

**Effort:** Small (under ~10 lines, whether inlined in `rotate.py` or added once to `_common.py`).

**Verification:**
- Rotate a test image and confirm the output is byte-identical to today's behavior (correct rotation, correct canvas expansion).
- Simulate a kill mid-`save()` (e.g. by raising inside a monkeypatched save in a quick manual test) and confirm the **original** `page-NNN.png` is untouched — this is the property being fixed, so check it directly rather than by inspection alone.

### Action P0-3: Fix the QA-verdict boolean coercion in both call sites

**Files:** `_engine/reconcile.py:61` and `_engine/manifest_media.py:222`

**Change:** Replace `bool(v.get('ok'))` with `v.get('ok') is True` in both places — a strict identity check against the Python boolean, so a JSON string `"false"` (or any other non-boolean truthy value) no longer reads as passing. This is the entire fix; no schema validator needed to close this specific hole, since the check only needs to stop trusting non-boolean values, not enumerate every malformed shape.

**Effort:** Trivial (one-line change, two files).

**Verification:**
- Add a throwaway `_qa/page-999.json` with `{"ok": "false", "missing_count": 0}` and confirm `reconcile.py` now reports it as a QA failure, not clean (today it would incorrectly pass).
- Re-run `reconcile.py --all` against French's real in-progress data afterward and confirm the exit code / gap report is unchanged from before the fix (i.e., no false positives introduced against real, correctly-typed data).

---

## P1 — fix opportunistically, before it bites once

### Action P1-1: Make enrichment-chunk merge precedence explicit (latest wins) and warn on conflict

**File:** `_engine/merge_enrich.py`

**Change:** In `_load_chunks` (`:22-30`), sort the glob results by file modification time (`os.path.getmtime`) instead of filename, so later-written chunks are appended last. In `merge_class` (`:33-46`), change the dedup loop to let a later-seen page **overwrite** an earlier one (build the `out` dict keyed by page, last-write-wins, instead of `if pg in seen: continue`), and print a one-line warning when an overwrite actually happens (`"! page %d present in multiple chunks — using most recent"`) so a real conflict is visible in the run log instead of silent. For `merge_questions` (`:49-56`), add the equivalent visibility at minimum — printing a count of question rows whose `(source_page, item)` pair repeats across chunks — even if full dedup semantics for questions need a separate follow-up decision (unlike classification, questions don't have a natural 1:1 key already established elsewhere in the system, so don't invent one under this action; just make existing duplication visible first).

**Effort:** Small (reorder one sort key, change one dict-building loop, add two print statements).

**Verification:** Construct two overlapping test chunks (`chunk-1-50.json` with a deliberately wrong entry for page 30, `chunk-25-50.json` written *after* it with the corrected entry) and confirm the merged `_class.json` now contains the corrected page-30 entry, with a warning printed during the merge.

### Action P1-2: Stop `_flat()` from stringifying `None`

**File:** `_engine/build_exports.py:55-57`

**Change:** `def _flat(v): return '' if v is None else ' '.join(str(v).split())` — one line.

**Effort:** Trivial.

**Verification:** Re-run `build_exports.py` against a collection with at least one chunk containing a JSON `null` field (or add one to a test fixture) and confirm the resulting CSV cell is empty, not the string `None`.

### Action P1-3: Cross-check `reconcile.py`'s expected page count against the source PDF when available

**File:** `_engine/reconcile.py:48-53`

**Change:** When the collection's `collections.json` entry has a `pdf` path and the file exists, open it once with `fitz.open()` (already a dependency, used in `pdf_to_images.py`) to get the real page count, and compare against the on-disk image count; if they disagree, print an explicit warning line (e.g. `"! only 30/50 pages rasterized — pdf_to_images.py may have been interrupted"`) rather than silently treating the disk count as ground truth. Keep the existing disk-count behavior as the fallback when `images_preexisting: true` (no PDF re-check possible/desired for those) or no `pdf` field exists.

**Effort:** Small (one added check, gated behind an `os.path.exists` on the PDF path, reusing the `fitz` import pattern already established in `pdf_to_images.py`).

**Verification:** Truncate a test collection's `images/` folder to fewer files than its source PDF's real page count and confirm `reconcile.py` now prints the rasterization-gap warning instead of reporting CLEAN once the truncated set is fully transcribed.

### Action P1-4: Add a handful of targeted fixture tests for exactly the bugs found in this review — not a coverage mandate

**Where:** new `_engine/tests/` folder (doesn't exist yet), plain `unittest`/`pytest`-style, no new dependency required beyond adding `pytest` itself if not already available.

**Change:** Write small, fixture-based tests for: (1) `atomic_open`/`atomic_write_text` — confirm a simulated failure mid-write leaves the original file untouched; (2) the P0-3 `ok: "false"`-string case; (3) the P1-1 overlapping-chunk-precedence case; (4) the P1-2 `_flat(None)` case; (5) `package_exports.py`'s stage-then-swap behavior under a simulated crash. Five tests, each mapping directly to a finding in this review — deliberately not a general "test everything" push, matching the review's explicit anti-over-engineering stance.

**Effort:** Medium (new folder + ~5 small test files, but each test is a direct translation of a verification step already listed above).

**Verification:** `pytest _engine/tests/` passes; each test fails against the pre-fix code (confirm by running once before applying P0-1/P0-3/P1-1/P1-2) and passes after.

### Action P1-5: Reconcile documentation with actual state

**Files:** root `README.md`, `german/README.md`, `german/extracted/README.md`

**Change:** Update root `README.md`'s "Supported Languages" list to distinguish shipped (German), in-progress (French), and not-yet-started (japanese/portuguese/romanian/russian/spanish) rather than listing all 7 identically. Update `german/README.md`/`german/extracted/README.md` to reflect that the PDF-vision pipeline is the one that actually ran and shipped 636 pages, rather than describing an unfinished "phase 2" as if it were the current state (the web-scrape channel, if still relevant, can be described as a secondary/experimental path rather than the primary narrative).

**Effort:** Trivial (doc edits only, no code).

**Verification:** Read each updated file back and confirm it matches what's actually on disk (`german/extracted/_exports/`, `DELIVERY-NOTES.md`, and the empty language folders) — this is a documentation change, so "verification" is just an accuracy re-read, not a test run.

---

## P2 — fix when convenient, no active risk

| Item | Change | Effort |
|---|---|---|
| P2-1: dead duplicate scripts | Delete `french/extracted/_tools/{rotate,zoom}.py` and German's `_tools/{manifest_media,pdf_to_images}.py` once confirmed unreferenced and truly equivalent (`agent_transcribe.md` already hardcodes `_engine/` paths). **Not** German's `_tools/{catalog,questions,vocabulary,merge_all,package_exports}.py` — those implement German's real, different, shipped 3-tier export structure that `_engine/build_exports.py`/`package_exports.py` deliberately don't replicate; keep them. | Trivial |
| P2-2: orphan `deutsch-pruefung` dataset | Decide and document: either add it as a real entry in `german/extracted/_tools/collections.json` (frozen, since it's already fully verified) so it's visible to `reconcile.py`/exports, or add one sentence to `german/README.md` explicitly naming it as a permanently separate, out-of-band channel. Either is fine — the fix is making the choice explicit, not the choice itself. | Small |
| P2-3: French manifest drift | Run `python _engine/manifest_media.py --root french/extracted sync` — no code change needed, this is exactly what `sync` exists for. | Trivial |
| P2-4: French's two-schema split | No action recommended — already a locked decision. Noted here only so it isn't rediscovered as a "bug" in a future iteration. | None |

---

## Next highest-value action

**Action P0-1** (stage-then-swap `_exports/`) — of the three P0 items, this is the one sitting directly on top of the actual deliverable handed to a content team, and it's the clearest, cleanest instance of the codebase's own stated invariant being contradicted by its own terminal step. Fix this one first; P0-2 and P0-3 are equally cheap but P0-1 has the largest blast radius if French's current in-progress batch reaches packaging before it's addressed.
