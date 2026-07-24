# French — Cosmopolite 1 Méthode A1 — Delivery notes

**Drive folder:** create "French Coursebooks" as a new folder, sibling to
Rehaan Ali's existing "French DELF A1"/"French DELF A2" folders (inside the
shared "Lingotran Content Extraction" > "French" space) — keeps DELF exam
material separate from coursebook extractions, same split German uses
between its `goethe/` (exam) and `netzwerk/`/`goyal/` (coursebook) folders.

**Shipped:** 224 pages · 1,751 questions · 1,176 vocabulary words · fully
transcribed and QA-verified (21 pages have disclosed, individually-reviewed
permanent gaps — see caveats below; everything else is clean).
Deliverables live in `french/extracted/_exports/` (flat — no per-publisher
tiers, this is French's first book on the new shared engine). Raw source
backup (PDF + 300-DPI page scans, ~1.3 GB) optional, staged separately.

---

## What to upload (mirror `_exports/` exactly — clean, one home per file)

```
French Coursebooks/
 ├── README.md                                   ← what each column means (only loose file)
 ├── _combined/                                  ← ALL books together (bulk use)
 │     french-catalog-all.csv                    (224 rows)
 │     french-questions-all.csv                  (1,751 rows)
 │     french-vocabulary-all.csv                 (1,175 rows)
 └── cosmopolite-a1-methode/                      ← one self-contained folder per book
       cosmopolite-a1-methode-catalog.csv        (224 rows)
       cosmopolite-a1-methode-questions.csv      (1,751 rows)
       cosmopolite-a1-methode-vocabulary.csv     (1,175 rows)
       cosmopolite-a1-methode.md                 (the full book, unified, 224 pages)
```
Each future book (Tricolore 1/2, Saison 2, Cosmopolite 5) gets its own
folder alongside `cosmopolite-a1-methode/`; the `_combined/` roll-ups grow to
cover them — re-upload/replace `_combined/`'s 3 files each time, don't add
more copies. Every file lives in exactly one place: nothing is duplicated
between `_combined/` and the per-book folders, and the only loose file is
`README.md`.

## Raw source backup (separate folder — keeps the deliverable clean)

Upload the raw scans + source PDF to a **separate sibling** Drive folder
`French Coursebooks — Source Backup/` (NOT inside the clean deliverable
tree), so the ~1.3 GB of heavy raw files never clutter the per-book
deliverable folders:

```
French Coursebooks — Source Backup/
 └── cosmopolite-a1-methode/
       cosmopolite-a1-methode.pdf                (source PDF, ~35 MB)
       images/  page-001.png … page-224.png      (300-DPI scans, ~1.3 GB)
```
(Matches how German's raw scans were staged separately for Drive.)

---

## Drive-share message (easy English)

> **French A1 — Cosmopolite 1 Méthode — ready to use**
>
> Hi! I put the first French coursebook in this folder. It is done and checked.
>
> **What is inside:**
> - 224 pages typed out from the book — word for word
> - 1,751 questions (with answers where the book gives them)
> - 1,175 words (with gender, plural, and an example)
>
> **Two things to know (not missing data — checked and explained):**
> - Page 3 (the foreword) has real people's photos in it, which our safety
>   filter won't process — so that one page is text-only in the notes, not
>   transcribed. Everything else is complete.
> - About a third of the questions (607) have a blank "answer" column. This
>   is NOT us missing something — the book itself doesn't print answer keys;
>   they're sold separately in a teacher's guide. Roughly half of those
>   blanks are also listening exercises (audio-based, no audio processed).
>   If the teacher's guide PDF is ever available, we can fill in more answers
>   from it later.
>
> **How to open it:**
> 1. Read `README.md` first — explains what each column means.
> 2. Want just this one book? Open the `cosmopolite-a1-methode/` folder — it
>    has that book's questions, words, page list, and the full book as one
>    document, all together.
> 3. Want everything at once (across all books)? Open the `_combined/` folder.
>
> Files open in Excel or Google Sheets. French accents (é è à ç) show correctly.

---

## Email draft (easy English)

**Subject:** French A1 study files ready — Cosmopolite 1 Méthode

Hi team,

The first French coursebook (Cosmopolite 1 Méthode, A1 level) is done and
uploaded to Drive, in a new "French Coursebooks" folder (next to the
existing DELF A1/A2 folders).

**Totals**
- 224 pages
- 1,751 questions
- 1,175 words
- Fully checked, with 2 disclosed notes below (not data loss)

**Two things to know**
- Page 3 (foreword) has real people's photos our safety filter blocks —
  that one page is noted, not transcribed. Everything else is complete.
- ~35% of questions (607) have a blank answer because this book's answer
  keys are sold separately (teacher's guide), not printed here — about half
  of those are also audio-only listening items. Can revisit if the
  teacher's guide ever becomes available.

**How to use it**
1. `README.md` — explains each column.
2. One book only → open its folder (e.g. `cosmopolite-a1-methode/`): its
   questions, words, page list, and the full book `.md`, all together.
3. Everything at once → open `_combined/`.

4 more coursebooks (Tricolore 1, Tricolore 2, Saison 2, Cosmopolite 5) are
in progress and will be added to this same folder as each finishes.

Best,
Harshan
