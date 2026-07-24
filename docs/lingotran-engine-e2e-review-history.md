# Lingotran Engine — E2E Review History

Append-only log of each review loop iteration: scope, grade, headline findings, and what changed since the previous pass. Newest entry first.

> See [`lingotran-engine-e2e-review.md`](lingotran-engine-e2e-review.md) for the current full narrative review, [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) for the current full findings list, and [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) for the current fix plan.

---

## Iteration 2 — 2026-07-24

**Scope reviewed:** Independent, from-scratch re-verification — not a re-read of iteration 1's own conclusions. Re-read every `_engine/*.py` script (all 10 + `_common.py`) and all 3 `agent_*.md` playbooks line by line; ran the real test suite (`python -m unittest discover -s _engine/tests -v` — 20/20 pass, confirmed firsthand); ran `_engine/reconcile.py` and `_engine/verify_answers.py` live against the real, delivered `french/extracted/cosmopolite-a1-methode/` data (not just read the code); spot-checked ~25 individual `page-NNN.md`/`_qa/page-NNN.json` files against the merged CSVs and `_exports/`; wrote and ran small throwaway repro scripts (outside the repo, no files added/modified) to directly test two suspected bugs rather than reason about them from the diff. Also assessed `level_mode: inferred` readiness specifically, since 4 of French's 5 remaining books use it and zero books have exercised that path yet.

**Grade assigned: B+** (up from B-). Full reasoning in the updated `lingotran-engine-e2e-review.md`.

**Iteration 1's claims independently re-verified — holds up:**
- All 3 P0s: confirmed fixed in the code, confirmed by the fixture tests (which I ran myself, not just read), and cross-checked against real data. `reconcile.py:79-84`/`manifest_media.py:222` both now do `v.get('ok') is True`; a real `_qa/page-003.json` with `"ok": false` in the delivered corpus is correctly caught. `package_exports.py:55-133`'s stage-then-swap is real and the crash-simulation test (`test_package_exports.py`) actually raises mid-copy and confirms the previous tree survives untouched. `rotate.py:18-20` now goes through `atomic_save_image`.
- All 5 P1s: confirmed. Real production CSVs (`french-questions-all.csv`, `french-vocabulary-all.csv`, 1751 + 1175 rows) contain zero literal `"None"` strings (P1-2). `merge_enrich.py`'s mtime-ordered, last-write-wins precedence + duplicate-visibility warnings are real and tested (P1-1). Root `README.md` and `german/README.md` were read in full and match actual on-disk state exactly, including the 5 empty language folders (P1-5). The 20-test suite exists and passes (P1-4).
- The "51 real data-quality issues found + fixed" claim (Addendum 2) is plausible and partially spot-checked: the real delivered `french-questions-all.csv` shows zero out-of-vocabulary `item_type` values today (all 1751 rows fall within `verify_answers.py`'s `VALID_ITEM_TYPES`), consistent with the claimed activity-type-leak and true-false-misclassification cleanup having actually landed.
- The repair-pass-edited-the-merged-file incident and its fix are documented in `PLAYBOOK.md`'s "Never dispatch an agent to edit a derived/merged file directly" section, confirmed present as described.

**Where the addendums' claims need a caveat (not wrong, but incomplete):**
- P0-2's "rotate.py now saves atomically" is true as stated but was fixed at the instance, not the risk class: `pdf_to_images.py`'s own `render()` (the function that produces the very images `rotate.py` later overwrites) still does a raw, non-atomic `pix.save(...)` — see new finding IT2-P1-1 below.
- P0-1's stage-then-swap is real, but the crash-simulation test only exercises a crash **during the copy phase** (before the final swap), not a crash in the narrow window **between** the two `os.replace()` calls that constitute the swap itself (`package_exports.py:129-132`) — see new finding IT2-P2-3.
- P1-3 ("reconcile.py cross-checks against the source PDF") is implemented correctly — I independently unit-tested `_rasterization_gap()` with a monkeypatched `fitz.open` and a truncated on-disk image set and confirmed it correctly detects the gap — but, unlike every other iteration-1 fix, it has zero fixture-test coverage in `_engine/tests/`, despite the action plan's own P1-4 explicitly calling for exactly that kind of test. Verified by manual/ad-hoc testing this iteration, not by an automated regression test that will catch a future regression.

**New findings this iteration (production data + fresh code read surfaced these; none were visible to iteration 1, which ran before any book had completed the full pipeline):**
- **IT2-P1-1**: `pdf_to_images.py:34-35` (`render()`) writes every rasterized page via a raw `pix.save(...)` — the exact non-atomic overwrite-in-place risk P0-2 already fixed for `rotate.py`, in a sibling call site that was missed. `--dpi`-flagged re-rasterization of an already-transcribed collection is a documented, supported CLI usage (`_engine/README.md:32`, `PLAYBOOK.md`'s efficiency-lessons section), so this isn't a hypothetical trigger.
- **IT2-P1-2**: `verify_answers.py:70`'s true-false auto-fix corrupts the answer when the source JSON has leading whitespace — `" vrai"` becomes `"Vraii"`, `" faux"` becomes `"Fauxx"` (confirmed by direct reproduction, not just read). Currently dormant in the real Cosmopolite A1 data (checked: 0 occurrences in the 112 real true-false rows), but it's a live, silent-corruption bug in the one code path this iteration's own new layer calls "safe, deterministic, zero judgment."
- **IT2-P1-3**: `reconcile.py`'s completeness gate — "the one check that must pass before calling a collection 100% done" — right now reports `GAPS FOUND` (exit 1) on Cosmopolite A1, the one book this iteration was asked to confirm was "fully delivered." Ran live: 21/224 pages have `qa: fail` (all genuine, individually-disclosed fine-print/scan-resolution limits, not data loss — verified by reading all 21 `_qa/page-NNN.json` files), but only 1 of those 21 (page 3) is reflected in `collections.json`'s `caveats` array, and there is no mechanism anywhere in `reconcile.py` to mark a page as "reviewed and permanently accepted" versus "still a live gap." This means `reconcile.py --all`, the standing pre-packaging gate `PLAYBOOK.md` tells every future run to treat as a hard stop, will report GAPS FOUND for French forever, mixing book 1's permanent accepted gaps with whatever real, new gaps book 2 introduces — exactly the alarm-fatigue failure mode the rest of this system's design (e.g., disk-truth-over-agent-claims) is built to avoid.
- **Gap, not a bug (see `lingotran-engine-e2e-review.md` for full discussion): `level_mode: inferred` is 100% prompt convention with zero code enforcement.** Grepped every `_engine/*.py` file: `level_mode` and `level_options` are referenced only in one docstring comment (`build_exports.py:27`) and never read, parsed, or validated by any executable code path. 4 of French's 5 remaining books (`tricolore-1-5th-edition`, `tricolore-2-5th-edition`, `saison-2-methode`, `cosmopolite-5-c1c2` — `collections.json:19-53`) use `inferred` mode, and none has been exercised yet.
- **Gap, not a bug: no "done but still exported" state.** `frozen: true` (the only existing protection primitive) means "excluded from `_engine`'s own outputs entirely" (`build_exports.py:282-284`, `reconcile.py:146-147`) — correct for German, whose real deliverable comes from separate legacy tooling, but wrong for a book like Cosmopolite A1 whose deliverable **is** `_engine`'s own merged CSV. Marking it `frozen` to protect it from accidental re-dispatch would silently drop its 224/1751/1175 rows from every future `french-*-all.csv`. Right now nothing but manual operator discipline stops a future transcribe/enrich dispatch from accidentally re-targeting it.
- **IT2-P2 items** (hygiene/coverage, no active risk): zero test coverage for `verify_answers.py` (where IT2-P1-2 was found), `pdf_to_images.py` (where IT2-P1-1 was found), and `manifest_media.py`; the narrow crash window in `package_exports.py`'s two-step directory swap noted above; several `json.load(open(path))` / `open(path).read()` call sites across `reconcile.py`, `build_exports.py`, `manifest_media.py`, `merge_enrich.py`, `verify_answers.py` that don't close their read handles (surfaced as `ResourceWarning`s by the test run itself), a real if low-probability-on-Windows hygiene gap given this codebase already cares about Windows `os.replace` semantics.

**Over-engineering check (re-run independently):** none found, same conclusion as iteration 1. Every new recommendation below is a small, targeted diff reusing an existing pattern in this codebase (`atomic_save_image` already exists for IT2-P1-1; the `caveats` array pattern already exists for the accepted-gap idea behind IT2-P1-3; `verify_answers.py`'s own "auto-fix the mechanical case, report the rest" convention is the template for the inferred-mode level check) — no new framework, dependency, or abstraction proposed anywhere in this pass.

**Code changes made this iteration: none.** Read-only verification, per the review brief. See [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) and [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) for the new iteration-2 items (clearly marked, not conflated with iteration 1's already-addressed list).

**Next highest-value action:** IT2-P1-3 (give `reconcile.py` a way to distinguish known/accepted gaps from new ones) — it's the one finding that will silently get worse with every future book if left alone, since the PLAYBOOK itself expects "genuine scan/print-resolution limits" to recur as a normal, accepted outcome on every real scanned book from here on.

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

---

### Addendum 3 — 2026-07-24: all 3 Iteration 2 findings (IT2-P1-1/2/3) fixed and verified

- **IT2-P1-1 fixed:** `pdf_to_images.py`'s `render()` now writes every rasterized page through `atomic_save_image()` instead of a raw `pix.save(...)` — the same temp-file-then-`os.replace()` helper `rotate.py` already uses, since `fitz.Pixmap` exposes `.save(path)` the same way a PIL `Image` does. Verified live: rendered a synthetic 2-page PDF end-to-end and confirmed both PNGs write correctly.
- **IT2-P1-2 fixed:** `verify_answers.py`'s true-false auto-fix no longer slices the original unstripped `correct_answer` string by the stripped `ans` variable's length (the root cause of `" vrai"` -> `"Vraii"`). Since the guard condition `ans in ('vrai', 'faux')` only matches when `ans` already IS the complete value, the fix is simply `it['correct_answer'] = ans.capitalize()` — no slicing/concatenation needed at all. Re-ran against the real Cosmopolite A1 data: 0 auto-fixes this pass (data was already clean from the prior run), confirming no regression.
- **IT2-P1-3 fixed:** `reconcile.py` now reads a new `accepted_qa_gaps` array (page numbers) from `collections.json` per collection, partitions any `qa: fail` pages into "new" (still blocks CLEAN) vs. "accepted" (printed every run, never silent, but doesn't block CLEAN or the exit code) — explicitly NOT available for `missing_md`/`missing_qa`, only for pages that were actually attempted and individually reviewed. Cosmopolite A1's real 21 disclosed permanent gaps (page-resolution/content-filter limits already documented in `caveats`) added to its `accepted_qa_gaps`. Ran live: `reconcile.py --root french/extracted cosmopolite-a1-methode` now reports `CLEAN` (previously `GAPS FOUND`), with all 21 accepted gaps still printed for visibility.

All 3 fixes are targeted, no new abstractions. `docs/lingotran-engine-e2e-review.md`, `-improvements.md`, `-action-plan.md` updated to mark these 3 findings resolved.
