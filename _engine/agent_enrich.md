# Per-range enrichment procedure (classify + questions) — text only, NO images

You enrich already-transcribed pages for a learning catalog + question bank.
Inputs: `collection`, and a `page` LIST/RANGE. Read each page's Markdown
transcription (NOT the image) and produce two outputs for the range.

## Parameters for this run (the orchestrator fills these in before dispatch)
- BASE: `<path/to/language/extracted>` (e.g. `d:/Harshan/harshan-personals/ventures/lingotran/lingotran-engine/french/extracted`)
- LANGUAGE: `<e.g. French>`
- LEVEL_MODE: `fixed | inferred` — from this collection's entry in `collections.json`
- LEVEL_OPTIONS: `<only used when LEVEL_MODE=inferred, e.g. A1, A2>`
- SECTION_TAXONOMY: `listening | reading | writing | speaking | grammar | none`

- read = `BASE/<collection>/pages/page-NNN.md` (NNN = zero-padded page)
- If an answer-key page is given in the task, read it too and use it to fill
  `correct_answer` for items it resolves.

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
- `section`: one of SECTION_TAXONOMY, or "" (best guess)
- `part`: the part or exercise-group label if printed (e.g. "Part 1", "Exercise 3"), else ""
- `instruction`: the exercise's printed RUBRIC — the sentence telling the learner what to
  do — VERBATIM, for the group this item belongs to (e.g. "Lis les publicités. Vrai, faux
  ou pas mentionné?", "Complète avec l'article correct."). Every item in the same `part`
  repeats the same rubric. Without it a stem like "Il y a ___ taille-crayon." is
  unreadable on its own — the reader cannot tell whether the task is to insert an
  article, conjugate a verb, or translate. If a group prints no rubric at all, use "".
  Do NOT paraphrase, invent, or translate it, and do NOT copy an exercise CONTENT line
  (a sentence to be completed) here — the rubric is the instruction, not the material.
- `item`: the printed item number/letter (e.g. "1", "2a"), else a running index
- `item_type`: multiple-choice, matching, true-false, fill-in, ordering, short-answer, writing-task, speaking-task, open-ended
- `question`: the item stem/prompt VERBATIM (LANGUAGE spelling/accents exact). For matching, state the left element.
- `option_a`,`option_b`,`option_c`: MC/choice options verbatim (else "")
- `correct_answer`: fill ONLY if resolvable — a marked answer on the page, or from an answer-key page you were given. Use "(open-ended)" for free writing/speaking tasks. Else "".
- `level`: if LEVEL_MODE=fixed, the collection's single level, always. If LEVEL_MODE=inferred, the level this specific item belongs to (read the inline tag left during transcription, which is written `[A1 (inferred)]`, or judge it yourself from LEVEL_OPTIONS if no tag is present — never leave blank). **Write the BARE level only — `A1`, `A2`, `B1`.** `level` is a taxonomy column, so its values are a fixed enum; never carry the transcription tag's "(inferred)" suffix into the record, and never combine two levels ("A2+B1") — use `mixed` if an item genuinely spans both. (This exact leak shipped once: tricolore-2-5th-edition recorded all 2,750 items as "A2 (inferred)"/"B1 (inferred)", so a level filter on the combined sheet silently missed every one of its rows.)
- `topic`: from the STEP 2 topic list
- `source_page`: 3-digit page string (e.g. "049")
Pages with NO discrete items (covers, pure wordlists, image-only, transcripts) contribute NO question rows — that is correct, do not invent items.

Write to `BASE/<collection>/pages/_questions/chunk-<first>-<last>.json`:
`{"collection":"<collection>","items":[ {<the fields above>}, ... ]}`
(empty items array is valid if the range has no practice items)

## STEP 4 — Return ONE line only
`enrich <collection> p<first>-<last>: <#pages classified> classified - <#items> questions`
