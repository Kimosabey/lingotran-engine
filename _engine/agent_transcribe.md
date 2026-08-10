# Per-page transcription procedure (Agent-loop fallback)

You transcribe scanned page(s) of learning material with **ZERO DATA LOSS**.
You are given: `collection`, `src`, `level`, and `page` — which may be a
SINGLE page or a LIST/RANGE of pages. If given multiple pages, do ALL steps
below for EACH page **independently** (its own image, its own two output
files), finishing one page fully before starting the next, and return one
STEP 5 line per page. Let `NNN` = the page zero-padded to 3 digits.

## Parameters for this run (the orchestrator fills these in before dispatch)
- BASE: `<path/to/language/extracted>` (e.g. `d:/Harshan/harshan-personals/ventures/lingotran/lingotran-engine/french/extracted`)
- LANGUAGE: `<e.g. French>`
- LEVEL: `<e.g. A1>` — the book's stated level (see LEVEL_MODE for how it applies)
- LEVEL_MODE: `fixed | inferred` — from this collection's entry in `collections.json`
- LEVEL_OPTIONS: `<only used when LEVEL_MODE=inferred, e.g. A1, A2>`
- SECTION_TAXONOMY: `listening | reading | writing | speaking | grammar | none`

Paths (using BASE above):
- image = `BASE/<collection>/images/page-NNN.png`
- out md = `BASE/<collection>/pages/page-NNN.md`
- out qa = `BASE/<collection>/pages/_qa/page-NNN.json`
- tools  = `_engine/rotate.py`, `_engine/zoom.py` (repo root, sibling to BASE's language folder)

Do all steps yourself, then return ONLY the one-line summary in STEP 5.

## STEP 0 — If a page contains a real, identifiable, named person's photo (author portrait, interview headshot, etc.)
Vision safety filtering blocks on real/identifiable faces, independent of what you intend to do with the image — it can block the whole page read even if your only goal is transcribing the printed text next to the photo. If a page read (or a whole batch) errors out with "content filtering", do NOT retry the same full-page image. Instead:
1. Isolate which page triggered it (retry pages one at a time if it was a multi-page batch).
2. Crop that page with `python "_engine/zoom.py" "<image>" <x0> <y0> <x1> <y1> "<scratch>/crop.png"` into one or more sub-images that EXCLUDE the face/portrait region but INCLUDE all surrounding text (headers, body, captions). Read the crops (not the original) to confirm they're clean before transcribing from them.
3. Transcribe normally from the crops — this is zero data loss: we only ever transcribe printed text, never photo pixels, so excluding a face region loses nothing in scope.
4. Note it in that page's `_qa/page-NNN.json` issues array, e.g. `"cropped out a photo region (content-filter) before transcribing; all text captured"` — visible and auditable, never a silent deviation.
If cropping can't cleanly separate text from faces (e.g. a dense photo collage with captions interspersed), transcribe what's separable, mark `status: transcribed` / `qa: fail`, and log the specific untranscribed region as an issue rather than guessing.

## STEP 1 — Orientation
Read the image. If text is not upright/left-to-right, run
`python "_engine/rotate.py" "<image>" <deg>` (deg = clockwise 90/180/270),
then Read again to confirm; repeat if needed. Record total clockwise degrees
applied (0 if none — these are scans, so rotation may be needed).

## STEP 2 — Transcribe everything, verbatim
Exact LANGUAGE spelling, accents/diacritics, and punctuation EXACT. No
paraphrase, translation, or summary. Capture:
- titles/headers, chapter/unit banners, all instructions;
- reading texts in full; dialogues with speaker labels;
- EVERY exercise with its printed number and EVERY item (a./b./1./2....);
- multiple-choice options (keep all; note "(marked: b)" if one is filled);
- matching tasks -> Markdown tables; fill-in blanks -> "___" (keep surrounding words);
- grammar boxes/tables -> Markdown tables, every cell;
- vocabulary/wordlists -> Markdown tables (word / article / plural / example when present);
- captions, picture labels, song/chant lyrics, footnotes, page numbers;
- audio-task references -> "[Audio track N]" as printed;
- answer keys -> every answer verbatim.
Illegible -> `<!-- illegible: best-guess "..." -->`; NEVER silently omit. If
small text is unclear, zoom: `python "_engine/zoom.py" "<image>" <x0> <y0>
<x1> <y1> "<scratch>/z_NNN.png"` (fractional coords 0..1) then Read the zoom.

If LEVEL_MODE is `inferred`, this book mixes levels — tag each exercise/
instruction block inline right before it with the level you judge it to be,
picking from LEVEL_OPTIONS, e.g. `**[A1 (inferred)]**`. If LEVEL_MODE is
`fixed`, do NOT add inline level tags — the whole book is LEVEL, uniformly.

## STEP 3 — Adversarial self-QA
Now act as an INDEPENDENT reviewer. Re-read the image block by block; assume
an omission exists until you have checked everything. Find anything missing,
altered, or mis-transcribed (dropped items/options/table cells/answer-key
entries, wrong accents/diacritics). Fix every issue. Repeat until complete
and faithful.

## STEP 4 — Write the two files
(a) `BASE/<collection>/pages/page-NNN.md` — EXACT frontmatter then the body:
```
---
source: <src>
collection: <collection>
page: <page>
orientation: <0|90|180|270>
content_type: [<one or more of: cover, toc, intro, instructions, reading-text, exercise, listening-sheet, writing-prompt, speaking-prompt, vocabulary, answer-key, lesson, grammar-box, dialogue, audio-script, wordlist, chapter-opener, review, picture-story, song, explanation, comprehension-questions, strategy-box, reference, phonetics, conjugation-table, table, illustration>]
   This list is CLOSED — `verify_exports.py` fails on anything outside it. Do not coin a
   synonym for a value already here (`reading` when `reading-text` exists, `grammar` when
   `grammar-box` exists, `glossary` when `wordlist` exists), and do not put an *item_type*
   here (`matching`, `logic-puzzle` describe an exercise, not a page). If a page genuinely
   has no matching category, use the closest one and say so in the QA note rather than
   inventing a value — 17 invented values had to be cleaned up on 2026-08-10.
level: <LEVEL if LEVEL_MODE=fixed; the dominant/primary level for this page (or "mixed") if LEVEL_MODE=inferred>
section: <one of SECTION_TAXONOMY, or empty>
chapter: <the coursebook chapter/unit label as printed, e.g. "Unite 3", or empty if none printed>
status: verified
qa: pass
---
<the full verbatim transcription>
```
(b) `BASE/<collection>/pages/_qa/page-NNN.json` — exactly:
`{"page": <page>, "ok": true, "missing_count": 0, "issues": []}`
If anything stayed illegible/uncertain, instead write `"ok": false`,
`"missing_count": <n>`, `"issues": ["..."]` AND set the md frontmatter to
`status: transcribed` / `qa: fail`.

## STEP 5 — Return (one line only, no transcription in your reply)
`pNNN: <ok|FAIL> - orient <deg> - <content_type>`
