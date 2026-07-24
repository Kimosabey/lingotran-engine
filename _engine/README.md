# `_engine/` — the shared extraction engine for every language

One set of tools, used by every language's PDF -> catalog/questions/vocabulary
pipeline. German's `german/extracted/_tools/` pioneered this design; `_engine/`
generalizes it so French (and future languages — Japanese, Portuguese,
Romanian, Russian, Spanish) don't each reinvent it.

## The `--root` contract

Every tool takes `--root <path/to/language/extracted>` — never a `--lang`
flag. The language slug (used in filenames like `french-catalog-all.csv`) is
derived mechanically from the path itself:
```
lang_slug(root) = os.path.basename(os.path.dirname(root))   # "french"
lang_dir(root)  = os.path.dirname(root)                       # ".../french"
```
See `_engine/_common.py`. This means:
- No hardcoded language names anywhere in `_engine/*.py`.
- You can point `--root` at an isolated test copy while building things out,
  without any code change.
- `collections.json`'s `pdf` field is resolved relative to `lang_dir(root)`
  (the language folder, e.g. `french/`), not `extracted/` — so
  `"pdf": "pdf/hachette-fle/cosmopolite-a1-methode/cosmopolite-a1-methode.pdf"`
  resolves to `french/pdf/...`.

## Tools

| Tool | Purpose |
|---|---|
| `_common.py` | Shared helpers every other tool imports: `parse_root`, `lang_slug`, `lang_dir`, `load_collections`/`load_collection_list`, `atomic_open`/`atomic_write_text`. Not run directly. |
| `pdf_to_images.py` | Rasterize a collection's source PDF to `images/page-NNN.png` (300 DPI, PyMuPDF). Skips any collection with `"images_preexisting": true`. |
| `rotate.py` | Rotate one PNG in place, clockwise, expanding canvas. No `--root` — takes an image path directly. |
| `zoom.py` | Crop + 2x-upscale a sub-region of one PNG for legible reading. No `--root` — takes an image path directly. |
| `manifest_media.py` | `init` / `dashboard` / `sync` / `qa-apply` — the TSV resume-anchor + human-readable dashboard for the transcribe/QA loop. |
| `merge_enrich.py` | Assembles agent-written `_class/chunk-*.json` and `_questions/chunk-*.json` into per-collection `_class.json` / `_questions.json`. |
| `reconcile.py` | Completeness sweep — recomputes transcription/classification gaps straight from disk (never trusts an agent's self-reported "done"). Run this after any batch to catch a silently-dropped range. |
| `verify_answers.py` | Correct-answer alignment sweep, run after `merge_enrich.py` and before `build_exports.py`. Auto-fixes the one deterministic case (a multiple-choice `correct_answer` that's a bare letter gets rewritten to that option's full text); reports everything else that needs a human/agent read (an MC answer not found among its own options — often a 4th+ printed option the 3-slot schema couldn't hold — and inconsistent `(open-ended...)` formatting) rather than guessing. |
| `build_exports.py` | Per-collection unified `.md` + parked debug CSVs, plus the ONE merged `<lang>-{catalog,questions,vocabulary}-all.csv` across every non-frozen collection. |
| `package_exports.py` | Copies the unified `.md`s + the 3 merged CSVs into a flat `_exports/` deliverable tree + writes a data-driven `README.md`. |

## The `agent_*.md` playbooks — parameter-substitution convention

`agent_transcribe.md`, `agent_enrich.md`, `agent_vocab.md` are prompt
templates, not code — they're dispatched to subagents, not executed by a
tool. Each starts with a **"Parameters for this run"** block (BASE, LANGUAGE,
LEVEL, LEVEL_MODE, LEVEL_OPTIONS, SECTION_TAXONOMY as relevant) that you, the
orchestrator, fill in with real values before pasting the rest of the file
into a subagent's task — the same way `collection`/`src`/`level`/`page` are
already filled in per-dispatch today. Nothing else in these files should
change between languages; if a language needs different wording, that's a
sign the parameter block is missing a token, not a reason to fork the file.

### `level_mode: fixed` vs `inferred`

From each collection's `collections.json` entry:
- `fixed` — the whole book is one CEFR level (German's model). `LEVEL` is
  constant; pages/items never carry a per-item level.
- `inferred` — the book mixes levels (some French books). Transcription
  tags each exercise inline (e.g. `**[A1 (inferred)]**`) from
  `LEVEL_OPTIONS`; enrichment's questions schema then carries a per-item
  `level` field pulled from that tag — a page-level `level` alone isn't
  enough when one page mixes levels.

### Section taxonomy

English, shared across every language: `listening | reading | writing |
speaking | grammar | none`. A separate `chapter` field carries the
coursebook chapter/unit label (e.g. "Unite 3") — a different concept from
`section` (exam/skill category), which German's original schema conflated
into one field. German's already-delivered data keeps its German-language
`section` values permanently (`hoeren`/`lesen`/`schreiben`/`sprechen`) — a
known, accepted, frozen inconsistency; only new languages use the English
taxonomy.

## Onboarding a new language

1. Create `<language>/extracted/_tools/collections.json` — top-level
   `language`/`language_code`, then one entry per book: `slug`, `family`
   (publisher), `level`, `level_mode` (`fixed`/`inferred`), `level_options`
   (if `inferred`), `pdf` (path relative to the language folder), `audio`
   (if any), `frozen` (omit/false for anything still in progress).
2. Lay the source PDF(s) out at `<language>/pdf/<publisher>/<variant>/<file>.pdf`.
3. Run the runbook: `pdf_to_images.py` -> `manifest_media.py init` ->
   dispatch `agent_transcribe.md` in small page-range batches -> `qa-apply`
   -> `reconcile.py` (confirm zero gaps) -> dispatch `agent_enrich.md` /
   `agent_vocab.md` -> `merge_enrich.py` -> `verify_answers.py` (fix/flag
   correct_answer alignment before it ships) -> `build_exports.py` ->
   `package_exports.py`.
4. Nothing in `_engine/*.py` needs to change. If it does, the change belongs
   to every language, not just the new one — treat that as a signal you're
   about to special-case something that shouldn't be special-cased.

## Safety invariant

German's 7 already-delivered Goethe collections are frozen and must never be
touched by anything in `_engine/`. Never invoke any `_engine/*` command with
`--root german/extracted`. After any `_engine/` operation, `git status
--porcelain -- german/` must be empty.
