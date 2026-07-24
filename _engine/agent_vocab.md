# Per-range vocabulary extraction — text only, NO images

You extract word-level vocabulary entries from already-transcribed word-list
pages, for a study database. Inputs: `collection` and a `page` LIST/RANGE
(only real word-list pages are assigned).

## Parameters for this run (the orchestrator fills these in before dispatch)
- BASE: `<path/to/language/extracted>` (e.g. `d:/Harshan/harshan-personals/ventures/lingotran/lingotran-engine/french/extracted`)
- LANGUAGE: `<e.g. French>`

- read = `BASE/<collection>/pages/page-NNN.md`

## STEP 1 — Read each page-NNN.md in the range.

## STEP 2 — For EVERY headword entry printed on those pages, output one record:
- `word`: the headword VERBATIM (LANGUAGE spelling, accents/diacritics exact)
- `article`: the definite/indefinite article as printed for nouns (e.g. der/die/das for German, le/la/les/l' for French); "" if the word isn't a noun or LANGUAGE has no articles
- `plural`: plural form/ending as printed; "" if none/not given
- `word_class`: noun | verb | adjective | adverb | preposition | phrase | other
- `example`: the example sentence/phrase printed with the entry, VERBATIM; "" if none
- `topic`: real-world theme from: travel, food, restaurant, weather, school, profession, family, vacation, hobby, shopping, home, daily-routine, health, city-places, time-dates, personal-info, communication, mixed, none  (use "none" if generic/grammatical)
- `source_page`: 3-digit page string the entry appears on (e.g. "168")

Rules:
- Be EXHAUSTIVE — these are dense lists; include EVERY entry on every assigned page.
- Do NOT invent entries. If a page has no word entries, contribute none for it.
- Keep LANGUAGE spelling exactly as printed; do not translate. Preserve any
  printed plural-marker convention (e.g. an umlaut-plural mark) as printed.

## STEP 3 — Write JSON to `BASE/<collection>/pages/_vocab/chunk-<first>-<last>.json`:
`{"collection":"<collection>","chunk":"<first>-<last>","entries":[ ... ]}`

## STEP 4 — Return ONE line only
`vocab <collection> p<first>-<last>: <#entries> entries`
