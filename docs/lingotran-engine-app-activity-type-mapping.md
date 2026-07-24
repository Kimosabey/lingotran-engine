# App Activity-Type Mapping — analysis + plan (not implemented)

**Status:** FYI / planning only. No code changes made for this. Captured here
so the analysis survives past the conversation that produced it, for when
this actually gets built.

## Why this exists

LingoTran's app/web app renders exercises using a fixed taxonomy of 37
interactive mechanics (see `activities-types.md` at the repo root — e.g.
`MCQ_T2T`, `FIB_T2T`, `Type_ConjV`, `Phrase_Rearrange`, `Jamboard`,
`Speech_Recognition_Analysis`). The extraction engine (`_engine/`) produces
its own, independent schema for transcribed textbook content — `item_type`
in the questions export (`multiple-choice`, `matching`, `true-false`,
`fill-in`, `ordering`, `short-answer`, `writing-task`, `speaking-task`,
`open-ended`), plus `activity_type`/`topic` in the catalog export.

The eventual goal: tag each extracted question with the closest-matching app
activity code at export time, so verified textbook content can feed
directly into building real app exercises. This doc is the mapping analysis
that a future implementation pass should start from.

## Mapping the 37 app types against our `item_type` schema

**Maps cleanly:**
- `FIB_T2T` ↔ `fill-in`
- `Type_T2T` / `Type_ConjV` ↔ `short-answer` (typed, no options given)
- `Phrase_Rearrange` ↔ `ordering`
- `Subjective` ↔ `writing-task` / `open-ended`
- `Vocab_Intro` ↔ vocabulary-presentation pages (a catalog/page-level concept,
  not a questions-row concept)

**Maps, but needs a signal we don't currently capture:**
- The `MCQ_*` family (`MCQ_T2T`, `MCQ_T2T_SP`, `MCQ_P2T`, `MCQ_T2P`,
  `MCQ_A2T`, `MCQ_T2A`) is one mechanic split by **prompt/answer modality**
  (text/picture/audio). Our `multiple-choice` is modality-blind. Picking the
  right variant needs a new signal — e.g. detecting an image reference or an
  `[Audio track N]` marker in the `question` text — not just a lookup on
  `item_type` alone.
- `Speech_Recognition_Analysis` vs `UserInfo14_UserVideo` — both plausible
  for our `speaking-task`, but we can't currently tell audio-only response
  from video response from a print source.

**Gaps — things we produce with no app-type equivalent:**
- `matching` — no app type is a generic "match pairs" mechanic. A fallback
  (force each pair into a single MCQ) loses the matching-table structure.
- `true-false` — same issue; would have to be repurposed as a 2-option MCQ.

**Gaps — app types with no realistic print-extraction source:**
- `MPInfo1_Prompt_Review`, `Rapid_Fire`, `Drop_In` — app-UI/pacing concepts
  (review screens, drill speed), not something a printed page encodes.
- `MPInfo1_Video` / `UserInfo14_UserVideo` — books don't contain video; at
  most a page might reference one.

**The biggest structural gap:** 9 of the 37 (`Article`, `Determiners`, `PD`,
`GD`, `PrepoD`, `Adjective`, `Modal_Verb`, `Inf_ConjVE_ARERIR`,
`Inf_ConjV_ARERIR`) are keyed on **grammar focus** (which part of
speech/grammar point an item drills), not on interaction mechanic. Our
schema has no equivalent dimension — `topic` is thematic (travel, food,
family...), not grammatical. Hitting these specific types later needs a new
grammar-focus signal, not just a lookup on existing fields.

## Important scope note: the 37 is not necessarily a closed set

Where our extraction produces something that genuinely doesn't map to any of
the 37 (`matching` and `true-false` are the two confirmed cases above), the
right move is not to force it into the closest-but-wrong existing type
(e.g. flattening a matching-table exercise into a single MCQ, losing the
pair structure). The mapping work should also consider **proposing new,
LingoTran-native activity types** for these genuine gaps, the same way the
existing 37 presumably got built up over time — not treat the current list
as fixed and our content as the thing that has to bend to fit it. This
applies specifically to `matching` (generic pair-matching, common in
coursebook exercises, no equivalent in the 37) and `true-false` (binary
judgment, currently only approximable as a 2-option MCQ). Decide this
per-gap when the mapping actually gets built, weighing how often that gap
type shows up in real extracted content (book 1 alone has real examples of
both) against the cost of adding and supporting a new app-side mechanic.

## Planned design (from the original plan, not yet built)

- **New export columns** on `QUESTIONS_COLUMNS` in `build_exports.py`, next
  to `item_type`:
  - `app_activity_type` — the mapped code, blank if no confident match.
  - `app_activity_confidence` — `rule` (clean deterministic match) vs
    `review` (ambiguous, needs a human/product spot-check). Never force a
    guess where the mapping above shows a real gap.
- **Mapping table lives in `_engine/`**, shared across every language (the
  app's 37 mechanics are language-independent) — e.g.
  `_engine/app_activity_map.json`, keyed by `item_type` (+ modality +,
  for the grammar-focus family, a topic/grammar tag we don't yet produce).
- **Stays a downstream, export-time-only concern.** `_questions.json`
  (written by `agent_enrich.md`) must stay a fact record of what's literally
  on the page — the same separation-of-concerns principle already applied
  to `section` vs `chapter`. The app-activity mapping is a product-specific
  *interpretation* of that fact, so it belongs only at export time, never
  written back into the enrichment source.
- **Build and validate against real data first.** Wait until a book with a
  meaningful volume of real, varied questions is enriched (Cosmopolite A1's
  1,751 items now qualify), then draft the mapping table against real
  `item_type`/`topic` values instead of the abstract list above, and surface
  the first draft for a spot-check before trusting it on more books.
