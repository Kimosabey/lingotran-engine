# Lingotran Engine — E2E Review

**Iteration:** 2 · **Date:** 2026-07-24 · **Reviewer stance:** independent, skeptical re-verification of iteration 1's own conclusions plus fresh code/data review — not a re-summary of the prior pass.

> Companion docs: [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) (what's wrong, by priority) · [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) (the specific fixes) · [`lingotran-engine-e2e-review-history.md`](lingotran-engine-e2e-review-history.md) (iteration log — see the Iteration 2 entry for the full list of what was independently re-checked and how).

> **Status note (2026-07-24, later same day):** all 3 new findings below (IT2-P1-1, IT2-P1-2, IT2-P1-3) were fixed and independently re-verified live the same day — see Addendum 3 in the review-history doc. This review's body is kept unmodified below as the historical record of what iteration 2 found.

## Current grade: **B+** (up from B- at iteration 1)

**Why it moved up:** every one of iteration 1's 3 P0s and 5 P1s was independently re-verified this iteration, not just re-read — the fixture test suite was actually run (20/20 pass), `reconcile.py`/`verify_answers.py` were run live against the real, delivered 224-page Cosmopolite A1 corpus, and the merged CSVs were checked directly for the specific defects claimed fixed (zero literal `"None"` strings; correct mtime-based merge precedence; a real `qa:false` page correctly rejected by the fixed boolean check). All of it holds up. The new `verify_answers.py` standing layer is a genuine, real addition that already found and fixed 51 real data-quality issues on the one book that's gone through it.

**Why it didn't move up further (not an A-/A):** this iteration's independent re-check — running the tools against real data instead of just reading the diffs — surfaced a fresh batch of real, evidenced issues sitting in the exact same "highest-stakes, zero-data-loss" territory iteration 1 was worried about, which suggests the iteration-1 fixes closed the specific instances found, not the underlying risk classes:
- `pdf_to_images.py`'s own image-rasterization write is still non-atomic — the identical bug class already fixed once in `rotate.py`, missed in a sibling call site.
- `verify_answers.py`'s new "safe, deterministic, zero-judgment" auto-fix has a real, reproducible silent-corruption bug (confirmed by direct repro, currently dormant in production data only by luck).
- `reconcile.py` — the system's own "one check that must pass before calling a collection done" — currently reports GAPS FOUND on the one book this iteration was asked to confirm was fully delivered, and has no way to distinguish a permanently-accepted, already-disclosed gap from a new one. This isn't a false claim (the 21 flagged pages are genuine, disclosed, low-severity scan-quality limits, not lost data) but it does mean the exit-code-as-hard-stop discipline the whole PLAYBOOK is built around will structurally degrade into noise for French from here on, exactly when the system is about to process 4 more books.
- `level_mode: inferred` — needed for 4 of French's remaining 5 books — turns out to be 100% prompt convention with zero code-level enforcement anywhere, completely unexercised by real data so far.

See the Iteration 2 entry in [`lingotran-engine-e2e-review-history.md`](lingotran-engine-e2e-review-history.md) for the full independent-verification log, and [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) for the new findings in full, each with file:line evidence.

---

## Iteration 1 narrative (2026-07-23) — kept for history, superseded by the above

**Grade at the time: B-**

A system with real engineering discipline — an incident-driven playbook, a genuinely well-built atomic-write primitive, a self-aware "don't over-build this" export policy — undercut by a handful of concrete bugs sitting in exactly the paths its own #1 rule ("zero data loss is non-negotiable") claims to cover, plus a meaningful gap between what the docs say is supported and what actually exists on disk. None of the individual bugs are hard to fix; the grade reflects that they exist at all in the highest-stakes spots, not that the system is architecturally unsound.

*(Note: the "Weaknesses" section immediately below describes the state as of iteration 1, 2026-07-23 — i.e., before the fixes recorded in `lingotran-engine-e2e-review-history.md`'s iteration-1 addendums. All 3 P0s and 5 P1s described here were subsequently fixed and independently re-verified in iteration 2; see above for what's still open.)

## What the system actually is

`_engine/` is a shared Python toolchain (`~_common.py` + 8 scripts) that turns a language-learning textbook PDF into structured, spreadsheet-ready data, via a pipeline that's part-code, part-LLM-subagent-prompt:

```
PDF --(pdf_to_images.py)--> page-NNN.png
    --(agent_transcribe.md, an LLM subagent)--> page-NNN.md + _qa/page-NNN.json
    --(manifest_media.py qa-apply/sync)--> manifest-media.tsv (derived cache)
    --(agent_enrich.md / agent_vocab.md, LLM subagents)--> _class/_questions/_vocab chunk-*.json
    --(merge_enrich.py)--> _class.json / _questions.json
    --(reconcile.py)--> completeness gate (must exit 0 before continuing)
    --(build_exports.py)--> per-book .md + CSVs + one merged <lang>-*-all.csv
    --(package_exports.py)--> _exports/ (the actual content-team deliverable)
```

Everything is parameterized by `--root <lang>/extracted` — no hardcoded language names in the Python layer, one shared engine for German, French, and (eventually) 5 more languages. A static, hand-authored HTML site (`site/`, no build step, deployed to Netlify) documents the pipeline and hosts French/German content pages.

## Strengths

- **The atomic-write core (`_common.py`) is well-built.** `atomic_open`/`atomic_write_text` write to a same-directory temp file and `os.replace()` on success — genuinely correct on both POSIX and Windows, correctly closes the handle before replace, cleans up on `BaseException` not just `Exception`. This is not boilerplate; it's the right primitive, and it's used correctly in `manifest_media.py`, `merge_enrich.py`, and `build_exports.py` (all writes in those three files go through it).
- **PLAYBOOK.md is incident-driven, not speculative.** Every mechanism traces to a real failure from the German run (a silently-dropped enrichment batch, an account-switch mid-batch) rather than defending against imagined risks. That's the right way to build an operating discipline.
- **Deliberate anti-over-engineering.** German's original 3-tier (per-collection / per-family / global) CSV export system was explicitly walked back to "one merged sheet per type, per-collection CSVs stay as parked debug artifacts" for French onward — a real instance of recognizing and undoing unnecessary complexity rather than defending it. `reconcile.py`'s design (glob the filesystem, never trust an agent's self-report) is the correct, minimal answer to the exact incident it was built for.
- **The site's recent UX pass was thorough and real, not cosmetic.** `site/UX-AUDIT.md` fixed genuine WCAG 2.2 AA contrast failures (measured, not eyeballed — real contrast ratios cited) and a mobile nav that was a hard dead-end below 720px, verified at 375px on all 4 pages.
- **No hardcoded language identity in the Python layer.** `lang_slug`/`lang_dir` are derived mechanically from `--root`; onboarding a new language touches zero `_engine/*.py` code, only `collections.json` — the abstraction is doing real, proportionate work.

## Weaknesses

### The "zero data loss" invariant has three concrete holes in its highest-stakes paths

The claim in `_engine/PLAYBOOK.md` — "every writer in this engine should use these [atomic] helpers" — does not hold universally, and the three places it fails are not edge cases:

1. **`package_exports.py`, the terminal packaging step** — the one script whose entire job is producing the artifact actually handed to the content team — destroys the previous `_exports/` tree (`shutil.rmtree`) before rebuilding it in place, with no staging directory and no atomic directory swap, and writes its own `README.md` with a bare `open(..., 'w')` instead of the atomic helper it doesn't even import. A crash here doesn't lose new data — it loses the *last known-good delivered export*, which is a worse outcome than the incident the whole playbook was written to prevent.
2. **`rotate.py` overwrites the source scan PNG in place** via a raw, non-atomic `Image.save()`, and it runs on a routine hot path — every page of every transcription pass, per `agent_transcribe.md`'s own procedure. A crash mid-write corrupts the one authoritative scan of that page, with no backup, and — worse — `reconcile.py` has no way to detect it, because a truncated-but-present PNG still satisfies the `glob('page-*.png')` completeness check.
3. **The QA gate itself has a type-coercion bug.** `reconcile.py`'s `_qa_ok` and `manifest_media.py`'s `qa_apply` both do `bool(v.get('ok'))` on agent-authored JSON with no schema validation anywhere upstream. If an LLM agent ever emits the JSON string `"false"` instead of the boolean `false` for `ok` — a plausible model slip, never validated against — `bool("false")` is `True` in Python. A genuinely failed page would silently read as passed, in the one check the system calls "the one check that must pass before calling a collection 100% done."

### The zero-data-loss guarantee structurally doesn't reach the bulk of the actual content

`page-NNN.md`, `_qa/*.json`, and every enrichment/vocab chunk — the highest-volume, longest-running, most crash-exposed layer of the whole system — are written by the LLM subagent's own file-editing tool, entirely outside `_common.py`'s reach. `reconcile.py` is a **detect-after-the-fact audit** for this layer, not a **prevention** mechanism, and the PLAYBOOK's own framing doesn't draw that line clearly. This isn't a bug to fix in code; it's a documentation-honesty gap (see the action plan).

### Merge-time and export-time data-fidelity bugs

- `merge_enrich.py` resolves overlapping enrichment chunks (e.g. a corrective re-run producing `chunk-25-50.json` alongside the original `chunk-1-50.json`) by **alphabetical chunk filename**, silently, with no warning printed — a corrected chunk can be silently outvoted by the bad original it was meant to replace, one layer downstream of the exact incident `reconcile.py` exists to catch.
- `build_exports.py`'s `_flat()` helper converts a JSON `null` into the literal string `"None"` before it ever reaches `csv.DictWriter` — which would have handled a real `None` correctly on its own. This directly affects the questions and vocabulary CSVs actually delivered to the content team.
- `reconcile.py`'s "expected page count" is derived from what's already rasterized on disk, not the source PDF's real page count — an interrupted `pdf_to_images.py` run is invisible to the one tool built to catch silent gaps.

### The documented and actual state of the project have drifted apart

- Root `README.md` lists all 7 languages as "Supported"; 5 of them (japanese, portuguese, romanian, russian, spanish) are empty, untracked folders with zero content.
- `german/README.md` and `german/extracted/README.md` describe an unfinished "phase 2" web-scrape channel as the primary mechanism; the real state is the opposite — German shipped 636 fully QA'd, exported pages months ago (per `DELIVERY-NOTES.md`).
- French is currently split across two incompatible, non-interoperating schemas: a legacy `manifest.tsv` system (287 pages, ~21% verified, 16 pages stuck in unresolved QA-fail, stalled for roughly a month) and a brand-new `collections.json`-based batch (5 books, 2 of ~1000+ pages transcribed) — this split is an explicit, already-made "locked decision" per commit history, not something this review is proposing to undo, but it means the legacy corpus has no path to ever getting `reconcile.py` coverage as things stand.

### No automated regression coverage anywhere

Zero test files (`test_*.py`, `*.spec.*`), no CI (`.github/` doesn't exist), no `pytest.ini`/`playwright.config.*` anywhere in the repo. Every guarantee in this system — the atomic helper, the completeness gate, the CSV builders — is verified only by running the real pipeline against real data and eyeballing the output. `site/UX-AUDIT.md`'s Playwright verification was real but one-time and not checked into the repo to rerun.

## Over-engineering check: none found

Explicitly looked for it, per the review brief. Nothing in `_engine/` reaches for an abstraction the job doesn't need: no framework, no config layer beyond `collections.json`, no job queue/scheduler (a documented non-goal), no test-everything mandate proposed here either — the action plan recommends a handful of targeted fixture tests aimed at the specific bugs found, not a coverage mandate. The site has no build tooling and doesn't need any at its current scope. The one place the project itself already recognized and reversed over-engineering (German's 3-tier export system) shows the discipline is already present; this review's recommendations are calibrated to match that discipline, not to introduce process for its own sake.

## What moves the grade up

- Fixing the 3 P0 items (destructive export rebuild, non-atomic image overwrite, QA boolean coercion) closes the gap between the stated invariant and the actual code — that alone is worth a full letter grade, since it's the difference between "the guarantee mostly holds" and "the guarantee holds in the paths that matter most."
- Fixing the P1 merge-precedence and `_flat(None)` bugs removes two live data-quality risks from deliverables already reaching a content team.
- Reconciling the documentation (README.md language list, German's stale phase-2 description) removes a real source of confusion for anyone — including a future subagent — picking up this project cold.

See [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) for the specific, minimal fix for each item above.

---

## Iteration 2 narrative (2026-07-24) — new findings, independent re-verification

This section is additive to the iteration-1 narrative above, not a replacement for it. Full item-by-item detail with file:line references lives in [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) (new items marked `IT2-`) and [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md); this is the narrative summary.

### What independent re-verification found: the iteration-1 fixes hold up

Rather than trust the review-history addendums' own "fixed and verified" claims, this pass re-derived the evidence firsthand: ran `python -m unittest discover -s _engine/tests -v` directly (20/20 pass, confirmed by reading the actual test output, not the addendum's summary of it); ran `_engine/reconcile.py --root french/extracted cosmopolite-a1-methode` and `_engine/verify_answers.py --root french/extracted cosmopolite-a1-methode` live against the real delivered data; opened `french/extracted/french-questions-all.csv` and `french-vocabulary-all.csv` (1751 and 1175 real rows) directly and grepped for the literal string `"None"` (zero hits — P1-2's fix is real in the actual deliverable, not just in a test fixture); read `french/extracted/cosmopolite-a1-methode/pages/page-003.md` and its `_qa/page-003.json` directly to confirm the P0-3 boolean fix correctly flags a real `ok:false` page. All of this holds up exactly as the addendums describe.

### New findings: the same failure classes recurring, now visible because real production data finally ran through the pipeline

1. **`pdf_to_images.py:34-35`** (`render()`) writes each freshly-rasterized page with a bare `pix.save(os.path.join(out_dir, 'page-%03d.png' % (i + 1)))` — fitz's `Pixmap.save()`, called directly, no `atomic_save_image` wrapper (which already exists in `_common.py:94-110` and already accepts anything with a `.save(path)` method, including a `fitz.Pixmap` — confirmed by the identical interface `rotate.py:20` already uses for a PIL `Image`). This is the exact non-atomic-overwrite risk class P0-2 fixed once already, missed in the one other place images get written to disk. `pdf_to_images.py --root <lang>/extracted --dpi 200 <slug>` re-rasterizing an already-transcribed collection is a documented, supported invocation (`_engine/README.md:32`, `PLAYBOOK.md`'s efficiency-lessons section), and nothing in `pdf_to_images.py` checks a `frozen` flag before doing it — so the same crash-mid-write-corrupts-the-only-scan risk P0-2 was built to close is still open here.
2. **`verify_answers.py:68-71`**'s true-false auto-fix — documented as "AUTO-FIX (safe, deterministic, zero judgment)" (`verify_answers.py:7`) — corrupts its own output when the source JSON has leading whitespace: `ans = correct_answer.strip()`, then `it['correct_answer'] = ans.capitalize() + it.get('correct_answer', '')[len(ans):]` slices the **unstripped** original by the **stripped** string's length, so `" vrai"` (5 chars) becomes `"Vrai" + "i"` = `"Vraii"`, and `" faux"` becomes `"Fauxx"`. Reproduced directly (not inferred from reading): see the review-history Iteration 2 entry for the exact repro. Zero occurrences in the real Cosmopolite A1 data today (checked all 112 real true-false rows) — dormant, not yet triggered, but live and silent (no warning is printed; it's classified as "fixed," bypassing the "NEEDS REPAIR PASS" reporting a human would actually notice).
3. **`reconcile.py`'s completeness gate reports GAPS FOUND, right now, on the book this iteration was asked to confirm was fully delivered.** Ran `python _engine/reconcile.py --root french/extracted cosmopolite-a1-methode`: `qa verdict not ok (21): [3, 5, 27, 28, 31, 34, 59, 85, 87, 91, 102, 103, 106, 111, 121, 128, 141, 153, 154, 221, 222]`, exit code 1. Read all 21 corresponding `_qa/page-NNN.json` files directly: every one is a genuine, individually-disclosed fine-print/scan-resolution limit (e.g. `page-027.json`: "Movie poster... fine-print production/legal credits block... too small to read even after 2x zoom"), exactly the accepted failure mode `PLAYBOOK.md`'s "New failure modes" section already documents as normal and expected. This is **not** data loss and **not** hidden — the same detail is embedded inline in the delivered `_exports/cosmopolite-a1-methode.md` as an HTML comment per page. But `collections.json:13-15`'s `caveats` array — the one place `build_exports.py`/`package_exports.py` surface a collection-level limitation in the actual deliverable README — names only 1 of these 21 pages (page 3's content-safety block). There is no field anywhere that lets `reconcile.py` know "these 20 pages were reviewed and are permanently accepted" versus "these are new and unexplained." The practical consequence: `reconcile.py --all`, the command `PLAYBOOK.md` tells every future run to treat as a hard stop before packaging, will report GAPS FOUND for French forever from this point on — and the next real gap in book 2, buried in the same undifferentiated list, is exactly the kind of thing this system's own "never trust a summary, always check disk truth" philosophy says shouldn't be allowed to blend into noise.

### Gap assessment: is the system ready for `level_mode: inferred`?

Asked directly, since 4 of French's 5 remaining books (`tricolore-1-5th-edition`, `tricolore-2-5th-edition`, `saison-2-methode`, `cosmopolite-5-c1c2`) use it and Cosmopolite A1 (the only book to go through the live pipeline so far) uses `fixed`. Answer: **no, not fully — the whole mechanism is unexercised prompt convention, not enforced code.** Grepped every `_engine/*.py` file for `level_mode`/`level_options`: the only hit is a docstring comment (`build_exports.py:27`); neither term is read, parsed, or validated by any executable code path anywhere in the engine. In practice this means:
- The per-item `level` value for an inferred-mode question (e.g. "A1 (inferred)") is whatever free-text string the enrichment LLM copies from an inline tag it — a different LLM dispatch, on a different page range — wrote during transcription (`agent_enrich.md:42`: "use the inline tag left during transcription... or judge it yourself... if no tag is present — never leave blank"). Nothing normalizes this, and nothing checks it against the collection's own declared `level_options` (`collections.json:24` etc.). A typo, an inconsistent format ("A1" vs "A1 (inferred)" vs "A1(inferred)") across different subagent dispatches on the same book would ship straight into `french-questions-all.csv`'s `level` column with zero code-level check anywhere — the same "trust the LLM's freeform text with no validation" pattern that P0-3 already showed is a real risk category in this codebase, just untested this time because no `inferred`-mode book has run yet.
- This is a real, right-sized thing to close **before** `tricolore-1-5th-edition` (French's next book, `level_mode: inferred`) starts, not before Cosmopolite (already `fixed`, already shipped). See the action plan for a small, `verify_answers.py`-style check (report-only, no auto-guessing) that would close this the same proportionate way P0-3/IT2-P1-2 should be closed.

### Gap assessment: is an already-delivered `_engine`-native book protected from accidental re-processing?

Asked because Cosmopolite A1 is genuinely done and French is about to move to book 2. Answer: **not really — the only existing primitive (`frozen: true`) is the wrong tool for this.** `build_exports.py:282-284` and `reconcile.py:146-147` both skip a `frozen` collection entirely, which is correct for German (whose real deliverable is produced by separate, already-frozen legacy tooling in `german/extracted/_tools/`) but wrong for Cosmopolite A1, whose actual deliverable **is** `_engine/build_exports.py`'s own merged CSV — marking it `frozen` to protect it would silently drop its 224/1751/1175 rows from every future `french-catalog/questions/vocabulary-all.csv`. `collections.json` (read in full, lines 1-55) has no `frozen` entry for `cosmopolite-a1-methode` today, and there is no other field that would protect it from an accidental future transcribe/enrich dispatch while still keeping it in the merged exports. Right now this is covered only by the "one book at a time, confirm-gated" operator discipline in `PLAYBOOK.md`'s operating model — real, but exactly the kind of thing this system's own philosophy says shouldn't be the only safeguard.

See [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) for the complete, numbered iteration-2 findings list (including the smaller P2 hygiene items — unclosed file handles, missing test coverage for `verify_answers.py`/`pdf_to_images.py`/`manifest_media.py`, the narrow residual crash window in `package_exports.py`'s directory swap) and [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) for the specific, minimal fix for each.
