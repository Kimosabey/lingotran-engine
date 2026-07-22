# Per-page transcription procedure (Agent-loop fallback)

You transcribe scanned page(s) of German A1 learning material with **ZERO DATA
LOSS**. You are given: `collection`, `src`, `level`, and `page` — which may be a
SINGLE page or a LIST/RANGE of pages. If given multiple pages, do ALL steps
below for EACH page **independently** (its own image, its own two output files),
finishing one page fully before starting the next, and return one STEP 5 line
per page. Let `NNN` = the page zero-padded to 3 digits.

Paths (BASE = `d:/Harshan/harshan-personals/ventures/lingotran/lingotran-engine/german/extracted`):
- image = `BASE/<collection>/images/page-NNN.png`
- out md = `BASE/<collection>/pages/page-NNN.md`
- out qa = `BASE/<collection>/pages/_qa/page-NNN.json`
- tools  = `BASE/_tools/rotate.py`, `BASE/_tools/zoom.py`

Do all steps yourself, then return ONLY the one-line summary in STEP 5.

## STEP 1 — Orientation
Read the image. If text is not upright/left-to-right, run
`python "BASE/_tools/rotate.py" "<image>" <deg>` (deg = clockwise 90/180/270),
then Read again to confirm; repeat if needed. Record total clockwise degrees
applied (0 if none — these are scans, so rotation may be needed).

## STEP 2 — Transcribe everything, verbatim
Exact German spelling, umlauts ä/ö/ü and ß, punctuation EXACT. No paraphrase,
translation, or summary. Capture:
- titles/headers, chapter/unit banners, all instructions;
- reading texts in full; dialogues with speaker labels;
- EVERY exercise with its printed number and EVERY item (a./b./1./2.…);
- multiple-choice options (keep all; note "(marked: b)" if one is filled);
- matching tasks → Markdown tables; fill-in blanks → "___" (keep surrounding words);
- grammar boxes/tables → Markdown tables, every cell;
- vocabulary/wordlists → Markdown tables (word · article · plural · example when present);
- captions, picture labels, song/chant lyrics, footnotes, page numbers;
- audio-task references → "🔊 [Hörtext N]" as printed;
- answer keys / Lösungen → every answer verbatim.
Illegible → `<!-- illegible: best-guess "..." -->`; NEVER silently omit. If small
text is unclear, zoom: `python "BASE/_tools/zoom.py" "<image>" <x0> <y0> <x1> <y1> "BASE/_tools/_z_NNN.png"` (fractional coords 0..1) then Read the zoom.

## STEP 3 — Adversarial self-QA
Now act as an INDEPENDENT reviewer. Re-read the image block by block; assume an
omission exists until you have checked everything. Find anything missing,
altered, or mis-transcribed (dropped items/options/table cells/answer-key
entries, wrong umlauts). Fix every issue. Repeat until complete and faithful.

## STEP 4 — Write the two files
(a) `BASE/<collection>/pages/page-NNN.md` — EXACT frontmatter then the body:
```
---
source: <src>
collection: <collection>
page: <page>
orientation: <0|90|180|270>
content_type: [<one or more of: cover, toc, intro, instructions, reading-text, exercise, listening-sheet, writing-prompt, speaking-prompt, vocabulary, answer-key, lesson, grammar-box, dialogue, audio-script, wordlist, chapter-opener, review, picture-story, song>]
level: <level>
section: <hoeren|lesen|schreiben|sprechen|vocabulary|answer-key or empty>
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
`pNNN: <ok|FAIL> · orient <deg> · <content_type>`
