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
- `section`: listening|reading|writing|speaking|vocabulary|answer-key or "" (best guess) —
  ALWAYS in English regardless of source language, matching the shared _engine/'s
  convention (see french/extracted's agent_enrich.md) — never write German/French/
  target-language words as taxonomy values here.
- `part`: the exercise-group label if printed (e.g. "Teil 1", "Übung 3"), else "".
  The FIELD NAME is English (it was `teil` until 2026-08-10, which left German's
  exported sheet misaligned with French's `part` for the identical concept); the
  VALUE stays exactly as printed, so "Teil 1" is correct content for it. Existing
  records that still use the old `teil` key are read as a fallback, so no page
  data had to be rewritten — but emit `part` for anything new.
- `instruction`: the exercise's printed RUBRIC — the sentence telling the learner what to
  do — VERBATIM in German, for the group this item belongs to (e.g. "Ergänze den Dialog.",
  "Kreuzen Sie an: richtig oder falsch?"). Every item in the same `part` repeats the same
  rubric. Without it a stem like "Er ___ in Zürich." is unreadable on its own — the reader
  cannot tell whether the task is to conjugate the verb or fill in a preposition. If a
  group prints no rubric, use "". Do NOT paraphrase, invent or translate it, and do NOT
  copy an exercise CONTENT line (a sentence to be completed) here.
- `item`: the printed item number/letter (e.g. "1", "2a"), else a running index
- `item_type`: multiple-choice, matching, true-false, fill-in, ordering, short-answer, writing-task, speaking-task, open-ended
- `question`: the item stem/prompt VERBATIM (German; umlauts/ß exact). For matching, state the left element.
- `option_a`,`option_b`,`option_c`: MC/choice options verbatim (else "")
- `correct_answer`: fill ONLY if resolvable — a marked answer on the page, or from a Lösungen/answer-key page you were given. Use "(open-ended)" for free writing/speaking tasks. Else "".
- `level`: the collection's CEFR level, BARE — `A1`, never a decorated variant like
  "A1 (inferred)". `level` is a taxonomy column with a fixed enum; the French side
  shipped "(inferred)"-suffixed values once and it silently broke level filtering on the
  combined sheet.
- `topic`: from the STEP 2 topic list
- `source_page`: 3-digit page string (e.g. "049")
Pages with NO discrete items (covers, pure wordlists, image-only, transcripts) contribute NO question rows — that is correct, do not invent items.

Write to `BASE/<collection>/pages/_questions/chunk-<first>-<last>.json`:
`{"collection":"<collection>","items":[ {<the fields above>}, ... ]}`
(empty items array is valid if the range has no practice items)

## STEP 4 — Return ONE line only
`enrich <collection> p<first>-<last>: <#pages classified> classified · <#items> questions`
