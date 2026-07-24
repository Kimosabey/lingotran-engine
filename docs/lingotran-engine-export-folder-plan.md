# Export folderization plan — per-book/per-PDF deliverable structure

> **Status:** ✅ IMPLEMENTED (2026-07-24). Both open decisions resolved
> ("do both"): raw source backup goes in a separate sibling Drive folder
> (Decision 1B), and the directory-swap was replaced by a watcher-safe
> in-place rebuild (Decision 2, superseding the retry idea — see the Open
> issue section for why). `_engine/package_exports.py` now produces this
> structure; verified live on Cosmopolite A1 with zero data loss (every row
> count matches source→delivered) and 32/32 tests passing.
> Last updated: 2026-07-24.

## Why this doc exists

Right now French's `_exports/` is **flat** — every book's `.md` sits next to
one shared set of combined CSVs, with no per-book grouping:

```
_exports/
  README.md
  cosmopolite-a1-methode.md
  french-catalog-all.csv          ← all books mixed, filter by `collection` column
  french-questions-all.csv
  french-vocabulary-all.csv
```

That was fine for 1 book. With 5 French coursebooks coming (and more
languages after), a reviewer opening the folder can't easily grab "just
Cosmopolite A1's data" — they'd have to open a 1,751-row combined sheet and
filter. German already solved this with **per-book folders + a `_combined/`
roll-up**, and its content team is used to that shape. This plan brings
French (and the shared engine) to the same, more understandable structure.

---

## The structure — clean, one home per file

Guiding rule (locked): **clean, no mess — every file lives in exactly one
place, no duplicates, no loose files scattered at the top.** Mirror German's
proven layout: one folder per book, plus a single `_combined/` folder for the
cross-book roll-ups.

```
_exports/
  README.md                            ← the ONLY loose file: index + column guide
  _combined/                           ← ALL books together (start here for bulk)
    french-catalog-all.csv
    french-questions-all.csv
    french-vocabulary-all.csv
  cosmopolite-a1-methode/              ← one self-contained folder per book
    cosmopolite-a1-methode-catalog.csv
    cosmopolite-a1-methode-questions.csv
    cosmopolite-a1-methode-vocabulary.csv
    cosmopolite-a1-methode.md          ← the whole book as one readable document
  tricolore-1-5th-edition/             (added when book 2 finishes)
    tricolore-1-5th-edition-catalog.csv
    tricolore-1-5th-edition-questions.csv
    tricolore-1-5th-edition-vocabulary.csv
    tricolore-1-5th-edition.md
  saison-2-methode/                    (later)
  tricolore-2-5th-edition/             (later)
  cosmopolite-5-c1c2/                  (later)
```

**What makes it clean (no mess):**
- Exactly **one** loose file at the top: `README.md`. Everything else is
  inside a folder.
- Each book's `.md` lives **only** inside its own folder — never also copied
  to the top level. No duplicates.
- Combined roll-ups live **only** in `_combined/` — never also at the top.
- A reviewer who wants one book opens one folder; who wants everything opens
  `_combined/`. Nothing to filter, nothing repeated.
- Identical mental model to German, so the content team learns it once.
- The per-book CSVs already exist on disk (`build_exports.py` writes them as
  "parked debug" artifacts today) — this just moves them into their clean
  home instead of leaving them behind.

---

## How this maps to Google Drive

Drive folder is **"French Coursebooks"** (new, sibling to Rehaan Ali's
existing "French DELF A1" / "French DELF A2" — confirmed 2026-07-24). Upload
mirrors `_exports/` 1:1:

```
Lingotran Content Extraction/
 └── French/
      ├── French DELF A1/         ← Rehaan Ali's DELF exam material (untouched)
      ├── French DELF A2/         ← Rehaan Ali's DELF exam material (untouched)
      └── French Coursebooks/     ← THIS engine's coursebook extractions
           ├── README.md
           ├── _combined/
           │     french-catalog-all.csv
           │     french-questions-all.csv
           │     french-vocabulary-all.csv
           └── cosmopolite-a1-methode/
                 cosmopolite-a1-methode-catalog.csv
                 cosmopolite-a1-methode-questions.csv
                 cosmopolite-a1-methode-vocabulary.csv
                 cosmopolite-a1-methode.md
```

(German's equivalent, for reference: `German/` holds `goethe/`, `netzwerk/`,
`goyal/` per-publisher folders + a `_combined/` — see
`german/extracted/DELIVERY-NOTES.md`.)

> **DECISION 1 — raw source backup (PDF + 300-DPI page scans, ~1.3 GB/book):**
> ✅ RESOLVED → **(B)** ("do both"). Upload raw scans too, kept OUT of the
> clean deliverable tree, in a separate sibling `French Coursebooks — Source
> Backup/` Drive folder so the heavy raw files never clutter the clean
> per-book deliverable folders. This is a Drive-upload step (documented in
> `french/extracted/DELIVERY-NOTES.md`), not something `package_exports.py`
> copies — the raw scans are gitignored local artifacts, staged manually
> like German's raw backup was.

---

## Naming convention (per book)

- Folder name = the book's **slug** from `collections.json`
  (e.g. `cosmopolite-a1-methode`) — already clean, no spaces, no watermark.
- Files inside = `<slug>-{catalog,questions,vocabulary}.csv` + `<slug>.md`.
- Combined = `french-{catalog,questions,vocabulary}-all.csv` — the `french`
  prefix is derived from the `--root` path, so Japanese would auto-produce
  `japanese-…-all.csv`, etc. No level (A1/A2) in the combined name because
  French books span multiple levels.

---

## What changes in code

Only `_engine/package_exports.py`. The per-book CSVs are already generated
by `build_exports.py`; this is purely a **packaging/copy** change — no
extraction, enrichment, or data change.

- [x] Copy each book's `<slug>-{catalog,questions,vocabulary}.csv` + `<slug>.md`
      into a per-book folder `_exports/<slug>/`.
- [x] Move the 3 combined CSVs into `_exports/_combined/` (not top level).
- [x] Stop writing the `<slug>.md` at the top level — it lives **only**
      inside `_exports/<slug>/`, so no file is duplicated.
- [x] Update the generated `README.md` book-index + folder-map text to
      describe the clean shape.
- [x] Prune stale files (old flat-layout leftovers) so re-runs never leave
      floating duplicates.

All of the above keep the "one home per file, README the only loose file"
rule — no top-level `.md` duplicates, no loose CSVs. Verified live on
Cosmopolite A1: the tree is exactly `README.md` + `_combined/` + one book
folder, no `.tmp`/`.old`/`.part` siblings, no empty folders for the 4
not-yet-processed books.

---

## Open issue found while prototyping — Windows directory-swap fragility (RESOLVED)

The first cut built into `_exports.tmp/` then did
`os.replace(_exports.tmp, _exports)` to swap atomically. On **Windows +
VS Code**, the editor's file-system watcher grabs a handle to any
freshly-created directory, so that final directory rename failed with
`WinError 5 (Access denied)` **every run** — even though the individual
files inside were perfectly writable. Confirmed live: a bounded retry (8
attempts, linear backoff) never cleared it, because the watcher holds the
handle for the whole run, not transiently. So a retry (Decision 2 option A)
was the wrong fix — it just delays the same guaranteed failure.

> **DECISION 2 — RESOLVED → in-place rebuild (option B, hardened).**
> Dropped the whole-directory swap entirely. `package_exports.py` now writes
> each file into `_exports/` **in place** with an atomic per-**file**
> `os.replace` (file renames are never blocked by the directory-handle lock),
> and prunes stale files **only after** every new file is in place. No
> sibling `.tmp`/`.old` directory is ever created, so nothing can be left
> floating and the watcher lock is irrelevant.
>
> The "all-or-nothing tree swap" guarantee is intentionally traded for a
> weaker-but-sufficient one that actually works here: `_exports/` is never
> emptied, the previous delivery survives until each file is atomically
> replaced, and a crash mid-run self-heals on the next run. This is safe
> because `_exports/` is 100% **derived** — every file is a copy of a source
> under `<root>/<slug>/` or `<root>/<lang>-*-all.csv` that this tool never
> touches, so there is no unique data in `_exports/` to lose. Covered by
> `test_package_exports.py`'s crash + prune tests.

---

## Not in scope for this doc (unchanged)

- On-disk source layout under `french/extracted/<slug>/` (pages, _qa,
  _class, _questions, _vocab, images) — that's the working tree, not the
  deliverable, and stays exactly as-is.
- German's frozen `_exports/` — never touched.
- The locked "one merged CSV per type, no per-family tier" decision still
  holds; this adds per-*book* folders, NOT per-*publisher-family* tiers
  (German has both; French deliberately skips the family tier).
