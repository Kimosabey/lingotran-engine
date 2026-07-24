# Lingotran Engine — Prioritized Improvement Areas

**Iteration:** 1 (2026-07-23) + **Iteration 2 additions** (2026-07-24, marked `IT2-` below)

> What's wrong and why it matters, ranked P0/P1/P2. For the specific fix + verification step for each item, see [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md). For the overall grade and system narrative, see [`lingotran-engine-e2e-review.md`](lingotran-engine-e2e-review.md).

**Priority definitions used below:**
- **P0** — active correctness/data-loss risk, sitting in a path the system already claims to guarantee against exactly this. Fix before the next real extraction run.
- **P1** — real risk, but lower frequency, smaller blast radius, or partially mitigated already. Fix opportunistically, before it bites once.
- **P2** — hygiene, drift, or clarity issues. No active risk; fix when convenient.

> **Status note (2026-07-24):** all of iteration 1's P0-1 through P1-5 below were independently re-verified as fixed this iteration (fixture tests actually run, 20/20 pass; real delivered CSVs spot-checked directly for each specific defect). They're kept below, unmodified, as the historical record of what iteration 1 found — see [`lingotran-engine-e2e-review-history.md`](lingotran-engine-e2e-review-history.md)'s Iteration 2 entry for the verification detail. P2-1 through P2-4 were also resolved as described in the Addendum 2 history entry. **New iteration-2 findings are in their own section below, clearly marked `IT2-`, not mixed into the iteration-1 list.**
>
> **Status note (2026-07-24, later same day):** IT2-P1-1, IT2-P1-2, and IT2-P1-3 below were also fixed and independently re-verified same-day (live re-run, not just read) — see [`lingotran-engine-e2e-review-history.md`](lingotran-engine-e2e-review-history.md)'s Addendum 3. Kept below, unmodified, as the historical record of what iteration 2 found.

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

---

# Iteration 2 additions — 2026-07-24

New findings only. Discovered by running the real tools against the real, delivered `french/extracted/cosmopolite-a1-methode/` data (not just reading the code) and by directly reproducing two suspected bugs in throwaway scripts before writing them up. None of these were visible to iteration 1, which ran before any book had completed the pipeline end-to-end. See [`lingotran-engine-e2e-review-history.md`](lingotran-engine-e2e-review-history.md)'s Iteration 2 entry and [`lingotran-engine-e2e-review.md`](lingotran-engine-e2e-review.md)'s Iteration 2 narrative for the full verification trail behind each item.

## IT2-P1 — real risk, smaller blast radius or partially mitigated (new)

### IT2-P1-1: `pdf_to_images.py` repeats the exact non-atomic overwrite risk P0-2 already fixed once, in a call site that was missed

**Where:** `_engine/pdf_to_images.py:34-35` — `render()`:
```python
pix = doc.load_page(i).get_pixmap(dpi=dpi)
pix.save(os.path.join(out_dir, 'page-%03d.png' % (i + 1)))
```
No `atomic_save_image` wrapper, unlike `rotate.py:18-20`'s identical write.

**Why it matters:** `_common.atomic_save_image()` (`_common.py:94-110`) already exists specifically to close this risk class, and already works with anything exposing a `.save(path)` method — a `fitz.Pixmap` (what `get_pixmap()` returns here) has exactly that interface, the same as the PIL `Image` `rotate.py` already routes through it. `pdf_to_images.py --root <lang>/extracted --dpi N <slug>` re-rasterizing an already-transcribed collection is a documented, supported invocation (`_engine/README.md:32`; `PLAYBOOK.md`'s efficiency-lessons section literally shows `--dpi 200 --all` as an example), and `pdf_to_images.py` has no `frozen`-flag check anywhere in `main()` — nothing stops it from being pointed at a collection whose pages have already been transcribed and QA'd. A crash mid-`save()` there corrupts the one authoritative scan a page's already-verified transcription depends on, invisible to `reconcile.py`'s `glob('page-*.png')` existence check — the identical failure mode P0-2's fix in `rotate.py` was written to close.

**Severity rationale:** Same risk class as P0-2 (non-atomic overwrite of a non-recoverable source, on a call site that real, documented usage can hit), narrower trigger condition (requires re-running rasterization against an already-processed collection, not every single page every pass) — P1, not P0, for that reason.

### IT2-P1-2: `verify_answers.py`'s true-false auto-fix silently corrupts its output on leading whitespace

**Where:** `_engine/verify_answers.py:68-71`:
```python
if ans in ('vrai', 'faux'):
    it['correct_answer'] = ans.capitalize() + it.get('correct_answer', '')[len(ans):]
    fixed += 1
```
`ans` is the **stripped** `correct_answer`; the slice `[len(ans):]` is applied to the **unstripped** original. Reproduced directly:
```
' vrai'  -> 'Vraii'
' faux'  -> 'Fauxx'
```
(both confirmed by direct execution, not inferred — see the review-history Iteration 2 entry).

**Why it matters:** this is the file's own "AUTO-FIX (safe, deterministic, zero judgment)" path (`verify_answers.py:7`) — the one category explicitly exempted from human/agent review, written straight back to `pages/_questions.json` via `atomic_write_text` with no report printed. A leading-whitespace `"vrai"`/`"faux"` value would silently ship a visibly-malformed answer (`"Vraii"`) into the delivered questions CSV with nothing flagging it for review, unlike every other case this file handles. Checked all 112 real true-false rows in the delivered `french-questions-all.csv` — zero occurrences today, so this hasn't shipped bad data yet, but it's a live, reproducible bug in code, not a hypothetical.

**Severity rationale:** Narrow trigger (requires literal leading/trailing whitespace around an otherwise-exact "vrai"/"faux" JSON value) and a single item type (true-false, 112 of 1751 items in the one book delivered so far) keep this P1 rather than P0, but it sits in a "trusted, no-review" pathway, which is exactly the aggravating factor that made the original P0-3 severe.

### IT2-P1-3: `reconcile.py`'s completeness gate has no way to distinguish a known/accepted gap from a new one — it will report GAPS FOUND for French forever, starting now

**Where:** `_engine/reconcile.py:79-84` (`_qa_ok`), `:135-188` (`main`); the accepted-gap data that's missing lives in `french/extracted/_tools/collections.json:13-16` (`caveats`, which names only 1 of the 21 real gaps below).

**Why it matters:** Ran `python _engine/reconcile.py --root french/extracted cosmopolite-a1-methode` against the real, delivered data:
```
cosmopolite-a1-methode           224 pages | GAPS FOUND
  qa verdict not ok         (21): [3, 5, 27, 28, 31, 34, 59, 85, 87, 91, 102, 103, 106, 111, 121, 128, 141, 153, 154, 221, 222]
RESULT: GAPS FOUND - do not declare done / do not package yet
```
Exit code 1, on the one book this review was asked to confirm was "fully delivered end-to-end." Read all 21 corresponding `_qa/page-NNN.json` files directly: every one is a genuine, already-disclosed, individually-documented fine-print/scan-resolution limit (e.g. `_qa/page-027.json`: "Movie poster... fine-print production/legal credits block... too small to read even after 2x zoom") — not data loss, and not hidden (the same text is embedded as an HTML comment in the delivered `_exports/cosmopolite-a1-methode.md`, confirmed present via `grep -c "QA ISSUES"` returning 21). But `collections.json`'s `caveats` array — the mechanism that's supposed to surface a collection's known limitations in the actual deliverable README — names only 1 of these 21 (page 3's content-safety block). Nothing in `reconcile.py` can tell "this qa:fail page was reviewed and permanently accepted" apart from "this is a genuinely new, unexplained gap." Since `PLAYBOOK.md`'s "New failure modes" section already documents this exact class of gap (fine-print/scan-resolution limits) as a normal, expected, permanent outcome that "stay[s] flagged after a genuine second attempt... that's a correct outcome, not a failure of the repair pass" — this will recur on every real scanned book from here on, meaning `reconcile.py --all` (the standing pre-packaging hard-stop command `PLAYBOOK.md` prescribes) will report GAPS FOUND for French permanently, blending book 1's 21 permanently-accepted gaps with whatever real, new gaps book 2 introduces, with no way to tell them apart except manually diffing the printed page-number list against memory.

**Severity rationale:** Not a false report (the tool is technically correct that these pages don't pass strict QA) and not itself data loss, but it directly undermines the one property the whole system's design philosophy depends on — a hard, trustworthy stop signal — for every future run on this language, starting immediately. Ranked P1 rather than P0 because nothing is silently wrong today (a human reading the full output would still see the real page list and could reason about it); the risk is the gate's future reliability eroding into something operators learn to skim past.

## IT2-P2 — hygiene, drift, and test-coverage gaps (new, no active risk)

### IT2-P2-1: Zero test coverage for the two files where this iteration found real bugs, plus one more recently-added file

**Where:** `_engine/tests/` has no `test_verify_answers.py`, no `test_pdf_to_images.py`, no `test_manifest_media.py` (confirmed by directory listing — only `test_common.py`, `test_build_exports.py`, `test_merge_enrich.py`, `test_package_exports.py`, `test_reconcile.py` exist).

**Why it matters:** IT2-P1-1 and IT2-P1-2 both live in files with zero test coverage. `verify_answers.py` in particular is a brand-new standing pipeline layer (added this same push) that already found 51 real data-quality issues in production — exactly the kind of file the project's own "write a fixture test for the specific bug found" convention (P1-4's own reasoning) would suggest covering. This is not a call for blanket coverage (matching the project's own anti-over-engineering stance, restated here deliberately) — just 2-3 targeted fixture tests mirroring the existing 5, one per real bug found.

### IT2-P2-2: `reconcile.py`'s P1-3 rasterization-gap check has no fixture test, unlike every other iteration-1 fix

**Where:** `_engine/reconcile.py:56-76` (`_rasterization_gap`) — implemented correctly (independently unit-tested this iteration with a monkeypatched `fitz.open` and a truncated on-disk image set; confirmed it correctly returns `(6, 10)` for 6-on-disk-vs-10-real-pages), but no corresponding test exists in `_engine/tests/`, unlike P0-1/P0-2/P0-3/P1-1/P1-2, which all got one.

**Why it matters:** The action plan's own P1-4 verification step for this item ("truncate a test collection's images/ folder... confirm reconcile.py now prints the rasterization-gap warning") describes exactly a fixture test, but it was never turned into one — the mechanism works today only because this review happened to check it by hand.

### IT2-P2-3: `package_exports.py`'s directory swap has a narrow, untested crash window between its two `os.replace()` calls

**Where:** `_engine/package_exports.py:128-132`:
```python
if os.path.isdir(final_out):
    shutil.rmtree(final_out + '.old', ignore_errors=True)
    os.replace(final_out, final_out + '.old')
os.replace(out, final_out)
```

**Why it matters:** A crash between these two lines leaves `_exports/` renamed away to `_exports.old/` with nothing at the real path — recoverable (the good tree is intact under `.old`, just needs a manual rename back), but not the "previous good tree completely untouched" guarantee the Addendum 1 history entry describes, which was verified only for a crash **during the copy phase** (`test_package_exports.py`'s `test_crash_mid_build_leaves_previous_good_exports_untouched` monkeypatches `shutil.copy2`, not `os.replace`). A true single-step atomic swap of two non-empty directories isn't available in the stdlib on either POSIX or Windows (`os.rename`/`os.replace` require the destination to not be a non-empty directory), so this two-step approach is a reasonable, deliberate trade-off, not an oversight — flagged here as a documented residual limitation, not something that needs a fix, matching this project's own practice of naming accepted trade-offs explicitly (e.g. P2-4) rather than pretending they don't exist.

### IT2-P2-4: Several read call sites across the engine don't close their file handles

**Where:** `reconcile.py:81,110,123,129`, `build_exports.py:94,103,115,127`, `manifest_media.py:159,219,225`, `merge_enrich.py:38`, `verify_answers.py:53` — all use `json.load(open(path))` or `open(path).read()` without a `with` block or explicit `.close()`. Surfaced directly by `ResourceWarning`s in the test suite's own output (e.g. `test_package_exports.py:27`, `test_reconcile.py:27` both trigger one).

**Why it matters:** CPython's refcounting closes these almost immediately in practice, so this is low-probability, not a demonstrated failure — but this codebase already had one real, documented Windows-specific `os.replace` gotcha (the Addendum 1 history entry's note about `os.replace` failing when the destination is a non-empty directory), so an open read handle to a path shortly before an `atomic_open`/`os.replace` targeting that same path is a real, if unlikely, class of "file in use" failure on Windows specifically, under memory pressure or a delayed GC. `_frontmatter()` in `manifest_media.py:139-155` already does this correctly with `with open(...) as f:`, so the fix is applying the existing correct pattern more consistently, not inventing one.

**Severity rationale:** P2 — no demonstrated failure, low probability, but a one-line-per-site fix with zero downside, and it's exactly the kind of thing this project's own Windows-atomicity carefulness elsewhere suggests is worth closing.

## Gaps (not bugs) worth a decision, not a P-ranked fix — see the review narrative for full discussion

- **`level_mode: inferred` readiness**: `level_mode`/`level_options` are referenced nowhere in executable `_engine/*.py` code (only a docstring comment, `build_exports.py:27`) — the entire mechanism is prompt convention, unenforced and unvalidated, and untested by any real book so far. 4 of French's 5 remaining books use it.
- **No "done but still exported" state**: `frozen: true` (`build_exports.py:282-284`, `reconcile.py:146-147`) means "excluded from `_engine`'s own outputs entirely," which is right for German's separately-tooled legacy corpus but would silently drop Cosmopolite A1's rows from every future merged CSV if applied to it. `collections.json` has no `frozen` entry for `cosmopolite-a1-methode` (confirmed, lines 1-55), and no other mechanism protects it from an accidental future transcribe/enrich re-dispatch while still keeping it in the merged exports.
