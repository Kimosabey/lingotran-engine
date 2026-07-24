# Lingotran Engine — E2E Review History

Append-only log of each review loop iteration: scope, grade, headline findings, and what changed since the previous pass. Newest entry first.

> See [`lingotran-engine-e2e-review.md`](lingotran-engine-e2e-review.md) for the current full narrative review, [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) for the current full findings list, and [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) for the current fix plan.

---

## Iteration 1 — 2026-07-23

**Scope reviewed:** Full `_engine/` pipeline (all 8 scripts + `_common.py` + the 3 `agent_*.md` subagent playbooks), `_engine/PLAYBOOK.md`/`README.md`, the `site/` static doc site + `site/UX-AUDIT.md` + root config (`netlify.toml`, `.claude/`), and the actual on-disk state of every language folder (german, french, japanese, portuguese, romanian, russian, spanish).

**Grade assigned:** **B-** (first grade under this review process — no prior baseline to compare against).

**Headline findings (see improvements.md for full list):**
- 3 × P0: `package_exports.py`'s destructive, non-atomic `_exports/` rebuild; `rotate.py`'s non-atomic in-place overwrite of source scan images on a per-page hot path; a boolean-coercion bug in the QA gate (`reconcile.py` + `manifest_media.py`) that would let a JSON string `"false"` read as a passing verdict.
- 5 × P1: silent alphabetical (not recency-based) precedence for overlapping enrichment chunks in `merge_enrich.py`; `build_exports.py`'s `_flat(None)` → literal `"None"` in deliverable CSVs; `reconcile.py`'s expected-page-count blind spot to interrupted rasterization; zero automated tests anywhere in the repo; documentation (root `README.md`, `german/README.md`) actively contradicting real project state.
- 4 × P2: dead duplicate script forks per-language; an orphan, fully-verified 113-page German dataset invisible to the tracking system; a known/expected manifest-drift instance in French's newest batch; French's already-decided two-schema split, named for completeness only.

**Data-reality check (not a code finding, but grounds the whole review):** of the 7 "supported" languages in root `README.md`, only German is actually shipped (636 pages, fully exported) and French is in progress (split across a stalled legacy corpus and a just-started new batch); the other 5 are empty, untracked folders.

**Over-engineering check:** none found. The system consistently erred toward simplicity already (no build tooling for the static site, no job queue, and a self-corrected 3-tier export system walked back to one merged sheet per type). All recommendations in this iteration are calibrated to match that existing discipline — small, targeted diffs reusing the existing atomic-write pattern, not new abstractions.

**Code changes made this iteration:** **none.** This iteration's deliverable is the 4 review documents themselves; the action plan's fixes are recommendations pending the user's go-ahead to implement.

**Next highest-value action:** Action P0-1 in the action plan — stage-then-swap `package_exports.py`'s `_exports/` rebuild, since it's the terminal step producing the actual content-team deliverable and the clearest instance of the system's own "zero data loss" claim being contradicted by its own code.

---

### Addendum — 2026-07-23, same day: all 3 P0 fixes applied and verified

Found and fixed mid-run, right before `package_exports.py` was about to be invoked for real on French's Cosmopolite A1 batch (the exact scenario P0-1's severity note warned about):

- **P0-1:** `package_exports.py` now builds into `_exports.tmp`, then does a two-step atomic swap (`os.replace` old `_exports/` -> `_exports.old`, then `os.replace` the new tmp dir -> `_exports/`, then remove `.old`) — not the single-step `os.replace(tmp, out)` the action plan first suggested, because that fails on Windows when `out` already exists as a non-empty directory (`os.replace` docs: raises `OSError` if `dst` is a directory, on both platforms — the "handles this correctly on both platforms" claim in the original action plan text was untested and turned out wrong for this exact case). The two-step move-old-aside-first version sidesteps that limitation on both platforms and was verified directly: two consecutive real runs succeed, and a monkeypatched mid-build crash leaves the previous `README.md` byte-for-byte unchanged with no `.old` directory left behind. Also fixed a real bug found while here — the `README.md` books-table loop still unpacked a 5-tuple after `caveats` had been added as a 6th manifest field earlier the same session, which would have crashed the very next run; caveats now render as a "Known limitations" section.
- **P0-2:** `rotate.py` now saves through a new shared `_common.atomic_save_image()` helper (temp file + `os.replace`), with the source opened via `with Image.open(path) as src:` so its file handle is released before the replace — an open handle to `path` would otherwise make the Windows replace fail.
- **P0-3:** both call sites (`reconcile.py:_qa_ok`, `manifest_media.py`'s qa-apply) changed from `bool(v.get('ok'))` to `v.get('ok') is True`, exactly as recommended.

P1/P2 items not addressed this pass — out of scope for what was blocking the in-progress French run.

---

### Addendum 2 — 2026-07-23, same day: verify_answers.py added + remaining P1/P2 closed out

**New standing layer:** `_engine/verify_answers.py`, run after `merge_enrich.py`/before `build_exports.py` from now on. Found and fixed real issues on Cosmopolite A1: 19 items with an `activity_type` value leaked into `item_type`, 30 items labeled `true-false` that were actually 2-way category-sorting exercises (reclassified to `multiple-choice`), plus smaller MC-bare-letter and open-ended-format inconsistencies. Also caught and corrected a real process bug: a repair-pass agent edited the merged `_questions.json` directly instead of the source-of-truth chunks, and a routine `merge_enrich.py` re-run silently erased the fix — redone on the correct files, `PLAYBOOK.md` updated so it can't recur.

**Remaining P1s closed:** P1-1 (merge precedence — now mtime-ordered + last-write-wins for classification, cross-chunk-only duplicate visibility for questions), P1-2 (`_flat(None)` fix), P1-3 (`reconcile.py` PDF-page-count cross-check). Plus a new row-count reconciliation check in `build_exports.py`/`package_exports.py` not originally in this review's findings list.

**P1-4 (tests) closed:** `_engine/tests/` added — 20 fixture tests across `test_common.py` (atomic write + atomic image save crash-safety), `test_reconcile.py` (P0-3's bool-coercion case), `test_merge_enrich.py` (P1-1's precedence + duplicate-detection cases, including the false-positive this review's own first draft of the fix would have produced), `test_build_exports.py` (`_flat(None)`), `test_package_exports.py` (P0-1's stage-then-swap crash-safety). All pass.

**P1-5 (doc drift) closed:** root `README.md`, `german/README.md`, `german/extracted/README.md` rewritten to reflect real state (German shipped via PDF-vision, not an unfinished "web phase 2"; French has 1 of 5 new PDFs done).

**P2-1 corrected, not blindly applied:** this review's own P2-1 finding claimed German's `_tools/{catalog,questions,vocabulary,merge_all,manifest_media,pdf_to_images,package_exports}.py` were all byte-identical duplicates of `_engine/`. Checking before deleting (required, since this touches German's frozen zone) found that claim wrong for 5 of the 7: `catalog.py`/`questions.py`/`vocabulary.py`/`merge_all.py`/`package_exports.py` (447+ lines) implement German's real, shipped 3-tier export structure (global + per-family + per-collection), which `_engine/build_exports.py`/`package_exports.py` deliberately don't replicate (one merged CSV, no tiers, per the locked export-scope decision). Those 5 were kept; only the 2 genuinely-superseded files (`manifest_media.py`, `pdf_to_images.py`, confirmed near-identical by actual diff) were removed, alongside French's confirmed-dead `rotate.py`/`zoom.py`. This review's own P2-1 text corrected to match.

**P2-2 closed:** `deutsch-pruefung` documented explicitly in both German READMEs as a deliberately separate, out-of-band web-scrape channel (different frontmatter schema, not part of the PDF corpus) rather than force-fit into `collections.json`'s PDF-oriented schema.

**P2-3, P2-4:** no action needed (already resolved / already a locked decision, per the original review).

**Lesson for future iterations of this review:** a P2 "safe to delete" finding about the frozen German zone still needs independent verification before acting, even when the review itself says "confirmed" — the confirmation here turned out to be wrong for most of the files it named.
