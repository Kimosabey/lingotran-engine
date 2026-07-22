# Per-range vocabulary extraction — text only, NO images

You extract word-level vocabulary entries from already-transcribed German A1
word-list / Wortschatz / Wortliste pages, for a study database. Inputs:
`collection` and a `page` LIST/RANGE (only real word-list pages are assigned).

BASE = `d:/Harshan/harshan-personals/ventures/lingotran/lingotran-engine/german/extracted`
- read = `BASE/<collection>/pages/page-NNN.md`

## STEP 1 — Read each page-NNN.md in the range.

## STEP 2 — For EVERY headword entry printed on those pages, output one record:
- `word`: the headword VERBATIM (German spelling, umlauts ä/ö/ü and ß exact)
- `article`: for nouns the definite article as printed (der / die / das); "" for non-nouns
- `plural`: plural form/ending as printed (e.g. "-e", "-en", "¨e", "Häuser"); "" if none/not given
- `word_class`: noun | verb | adjective | adverb | preposition | phrase | other
- `example`: the example sentence/phrase printed with the entry, VERBATIM; "" if none
- `topic`: real-world theme from: travel, food, restaurant, weather, school, profession, family, vacation, hobby, shopping, home, daily-routine, health, city-places, time-dates, personal-info, communication, mixed, none  (use "none" if generic/grammatical)
- `source_page`: 3-digit page string the entry appears on (e.g. "168")

Rules:
- Be EXHAUSTIVE — these are dense lists; include EVERY entry on every assigned page.
- Do NOT invent entries. If a page has no word entries, contribute none for it.
- Keep German exactly as printed; do not translate. Preserve the "¨" umlaut-plural marker as printed.

## STEP 3 — Write JSON to `BASE/<collection>/pages/_vocab/chunk-<first>-<last>.json`:
`{"collection":"<collection>","chunk":"<first>-<last>","entries":[ ... ]}`

## STEP 4 — Return ONE line only
`vocab <collection> p<first>-<last>: <#entries> entries`
