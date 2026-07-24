# Lingotran Engine — E2E Review

**Iteration:** 1 · **Date:** 2026-07-23 · **Reviewer stance:** Senior AI/ML lead engineer, external read of the system as it stands on disk today (not the aspirational README).

> Companion docs: [`lingotran-engine-e2e-improvements.md`](lingotran-engine-e2e-improvements.md) (what's wrong, by priority) · [`lingotran-engine-e2e-action-plan.md`](lingotran-engine-e2e-action-plan.md) (the specific fixes) · [`lingotran-engine-e2e-review-history.md`](lingotran-engine-e2e-review-history.md) (iteration log).

## Current grade: **B-**

A system with real engineering discipline — an incident-driven playbook, a genuinely well-built atomic-write primitive, a self-aware "don't over-build this" export policy — undercut by a handful of concrete bugs sitting in exactly the paths its own #1 rule ("zero data loss is non-negotiable") claims to cover, plus a meaningful gap between what the docs say is supported and what actually exists on disk. None of the individual bugs are hard to fix; the grade reflects that they exist at all in the highest-stakes spots, not that the system is architecturally unsound.

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
