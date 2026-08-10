# Lingotran Engine

A scalable workflow for extracting structured linguistic data from various language-learning PDFs, enabling the automated conversion of textbook content into structured JSON formats for personal study tools.

## Supported Languages
- **German** — shipped: 636 pages, fully transcribed, QA-verified, exported (`german/extracted/_exports/`).
- **French** — in progress: 3 of 5 new PDFs done via the shared `_engine/` pipeline (Cosmopolite A1 Méthode 224 pages, Tricolore 1 180 pages, Tricolore 2 180 pages), 2 remain (Saison 2, Cosmopolite 5); plus 2 legacy books on an older, separate pipeline (`conjugaison-a1-a2` partially transcribed, `revision-2` not started).
- Japanese, Portuguese, Romanian, Russian, Spanish — not yet started (empty stub folders).

## Overview
This engine is designed to parse multilingual text and structures from learning materials and translate them into a unified format for data consumption in learning applications.

## Cross-language export conventions

These apply to every language's pipeline, whether it uses the shared `_engine/` or its
own bespoke `_tools/` (e.g. German's), so exports stay usable to anyone regardless of
which source language they were extracted from:

- **All taxonomy/enum column values are English, always** — `section`, `activity_type`,
  `content_type`, `topic`, `word_class`, `status`, `qa`, `level` (`item_type` too). These
  are our own categorization scheme, not text copied from the book, so they must read in
  English no matter what language the source material is in. (Found and fixed
  2026-07-28: German's `section` column used German words — `hoeren`/`lesen`/`sprechen`/
  `schreiben` — instead of `listening`/`reading`/`speaking`/`writing`, across all
  non-frozen German books; each language's `agent_enrich.md` now states this explicitly.)
- **All column names are English, always, and identical across languages** — the header
  row is part of the schema, not the source material. (Found and fixed 2026-08-10:
  German's questions sheet named its exercise-group column `teil` where French named the
  same concept `part`, so the two languages' sheets did not line up for anyone reading
  both. Renamed to `part`; German's questions sheet also gained the `level` column French
  already had, so both languages now emit a byte-identical header.) A column that exists
  in one language and genuinely has no source data in another — `chapter`, which German
  books do not carry — is simply absent there rather than shipped permanently empty.
- **Verbatim/quoted fields stay in the source language** — the `question` text itself,
  answer options, examples, and printed part/unit labels — these are direct quotes from
  the book and must not be translated or reworded, unlike the taxonomy columns above.
  Note the distinction from the rule above: the `part` *column name* is English, while
  the *values* in it stay exactly as printed ("Teil 1", "Übung 2", "Unité 3").
- Before adding a new language's pipeline, re-check its `agent_enrich.md`/equivalent
  enrichment prompt for this rule, and spot-check a sample export for stray non-English
  taxonomy values before considering that language's export "done."
