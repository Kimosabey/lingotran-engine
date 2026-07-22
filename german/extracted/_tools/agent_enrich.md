# Per-range enrichment procedure (classify + questions) — text only, NO images

You enrich already-transcribed German A1 pages for a learning catalog + question
bank. Inputs: `collection`, and a `page` LIST/RANGE. Read each page's Markdown
transcription (NOT the image) and produce two outputs for the range.

BASE = `d:/Harshan/harshan-personals/ventures/lingotran/lingotran-engine/german/extracted`
- read  = `BASE/<collection>/pages/page-NNN.md` (NNN = zero-padded page)
- If an answer-key / Lösungen page is given in the task, read it too and use it
  to fill `correct_answer` for items it resolves.

## STEP 1 — Read every page-NNN.md in the range (and any answer-key page named).

## STEP 2 — CLASSIFY (one record per page)
For EACH page produce:
- `page`: integer
- `activity_type`: dominant task, from: multiple-choice, matching, true-false, fill-in, ordering, short-answer, writing-task, speaking-task, listening-comprehension, reading-comprehension, vocabulary, instructions, cover, answer-key, none
- `topic`: main real-world theme, from: travel, food, restaurant, weather, school, profession, family, vacation, hobby, shopping, home, daily-routine, health, city-places, time-dates, personal-info, communication, mixed, none  (use "mixed" if several; "none" for covers/instructions/answer-keys/wordlists/transcripts)
- `summary`: ONE English line (<= 15 words) describing the page so a human scanning the catalog instantly gets it.

Write to `BASE/<collection>/pages/_class/chunk-<first>-<last>.json`:
`{"collection":"<collection>","items":[{"page":N,"activity_type":"...","topic":"...","summary":"..."}, ...]}`
(exactly one item per page in the range)

## STEP 3 — QUESTIONS (one record per exam/exercise ITEM)
Scan the pages for discrete practice items (exercise questions, MC items,
matching pairs, true/false statements, fill-in items, writing/speaking prompts).
For EACH item output:
- `section`: hoeren|lesen|schreiben|sprechen|vocabulary|answer-key or "" (best guess)
- `teil`: the part/Teil or exercise-group label if printed (e.g. "Teil 1", "Übung 3"), else ""
- `item`: the printed item number/letter (e.g. "1", "2a"), else a running index
- `item_type`: multiple-choice, matching, true-false, fill-in, ordering, short-answer, writing-task, speaking-task, open-ended
- `question`: the item stem/prompt VERBATIM (German; umlauts/ß exact). For matching, state the left element.
- `option_a`,`option_b`,`option_c`: MC/choice options verbatim (else "")
- `correct_answer`: fill ONLY if resolvable — a marked answer on the page, or from a Lösungen/answer-key page you were given. Use "(open-ended)" for free writing/speaking tasks. Else "".
- `topic`: from the STEP 2 topic list
- `source_page`: 3-digit page string (e.g. "049")
Pages with NO discrete items (covers, pure wordlists, image-only, transcripts) contribute NO question rows — that is correct, do not invent items.

Write to `BASE/<collection>/pages/_questions/chunk-<first>-<last>.json`:
`{"collection":"<collection>","items":[ {<the fields above>}, ... ]}`
(empty items array is valid if the range has no practice items)

## STEP 4 — Return ONE line only
`enrich <collection> p<first>-<last>: <#pages classified> classified · <#items> questions`
