# French Coursebooks — Delivery notes

**Drive folder:** "French Coursebooks", sibling to Rehaan Ali's existing
"French DELF A1"/"French DELF A2" folders (inside the shared "Lingotran
Content Extraction" > "French" space) — keeps DELF exam material separate
from coursebook extractions, same split German uses between its `goethe/`
(exam) and `netzwerk/`/`goyal/` (coursebook) folders.

**Shipped so far (2 of 5 books):**
| Book | Status | Pages | Questions | Words |
|---|---|---|---|---|
| Cosmopolite 1 Méthode (A1) | ✅ delivered | 224 | 1,751 | 1,175 |
| Tricolore 1 (A1-A2) | ✅ **new this round** | 180 | 2,413 | 2,728 |
| Tricolore 2, Saison 2, Cosmopolite 5 | in progress | — | — | — |

Both delivered books are fully transcribed and QA-verified (each has a small
number of disclosed, individually-reviewed permanent gaps — see caveats
below; everything else is clean). Deliverables live in
`french/extracted/_exports/`. Raw source backup (PDFs + 300-DPI page scans)
optional, staged separately.

---

## What to upload (mirror `_exports/` exactly — clean, one home per file)

```
French Coursebooks/
 ├── README.md                                   ← what each column means (only loose file)
 ├── _combined/                                  ← ALL books together (bulk use)
 │     french-catalog-all.csv                    (404 rows)
 │     french-questions-all.csv                  (4,164 rows)
 │     french-vocabulary-all.csv                 (3,903 rows)
 ├── cosmopolite-a1-methode/                      ← one self-contained folder per book
 │     cosmopolite-a1-methode-catalog.csv        (224 rows)
 │     cosmopolite-a1-methode-questions.csv      (1,751 rows)
 │     cosmopolite-a1-methode-vocabulary.csv     (1,175 rows)
 │     cosmopolite-a1-methode.md                 (the full book, unified, 224 pages)
 └── tricolore-1-5th-edition/                     ← NEW this round
       tricolore-1-5th-edition-catalog.csv       (180 rows)
       tricolore-1-5th-edition-questions.csv     (2,413 rows)
       tricolore-1-5th-edition-vocabulary.csv    (2,728 rows)
       tricolore-1-5th-edition.md                (the full book, unified, 180 pages)
```
**Action needed:** replace all 3 `_combined/` files with the updated versions
above (they now cover both books, not just Cosmopolite A1), and add the new
`tricolore-1-5th-edition/` folder alongside the existing
`cosmopolite-a1-methode/` folder — don't remove or duplicate anything already
uploaded. Each future book (Tricolore 2, Saison 2, Cosmopolite 5) repeats this
same pattern: its own folder added, `_combined/` replaced (not appended to).

## Raw source backup (separate folder — keeps the deliverable clean)

Upload each book's raw scans + source PDF to the **separate sibling** Drive
folder `French Coursebooks — Source Backup/` (NOT inside the clean
deliverable tree):

```
French Coursebooks — Source Backup/
 ├── cosmopolite-a1-methode/
 │     cosmopolite-a1-methode.pdf                (source PDF, ~35 MB)
 │     images/  page-001.png … page-224.png      (300-DPI scans, ~1.3 GB)
 └── tricolore-1-5th-edition/                     ← NEW this round
       tricolore-1-5th-edition.pdf               (source PDF, ~46 MB)
       images/  page-001.png … page-180.png      (300-DPI scans, ~1.1 GB)
```
(Matches how German's raw scans were staged separately for Drive.)

---

## Drive-share message (easy English)

> **French A1-A2 study files — Tricolore 1 added**
>
> Hi! I added the second French coursebook to this folder. It is done and checked.
>
> **What's new (Tricolore 1, A1-A2 level):**
> - 180 pages typed out from the book — word for word
> - 2,413 questions (with answers where the book gives them)
> - 2,728 words (with gender, plural, and an example)
>
> **Running total (both books):** 404 pages · 4,164 questions · 3,903 words.
>
> **Two things to know about Tricolore 1 (not missing data — checked and explained):**
> - 6 pages have a tiny piece of content that couldn't be read even after a
>   second, closer look (things like a blurry decorative photo caption, or a
>   stylized cursive font on a small event ticket graphic) — none of it is
>   exercise or answer content, just decorative page elements. Everything
>   else on those pages is complete.
> - Just under half the questions (1,091) have a blank "answer" column. Same
>   reason as Cosmopolite A1: this book's answers are sold separately in a
>   teacher's guide, not printed here. About 196 more are "open-ended" writing/
>   speaking tasks that don't have one single answer — those are marked
>   differently, not counted as blanks.
>
> **How to open it:**
> 1. Read `README.md` first — explains what each column means.
> 2. Want just one book? Open its folder (`cosmopolite-a1-methode/` or
>    `tricolore-1-5th-edition/`) — questions, words, page list, and the full
>    book as one document, all together.
> 3. Want everything at once (across both books)? Open the `_combined/` folder
>    (just replaced with the updated version covering both books now).
>
> Files open in Excel or Google Sheets. French accents (é è à ç) show correctly.

---

## Email draft (easy English)

**Subject:** French study files updated — Tricolore 1 added (2 of 5 books done)

Hi team,

The second French coursebook (Tricolore 1, A1-A2 level) is done and added to
the same "French Coursebooks" Drive folder as Cosmopolite A1.

**What's new (Tricolore 1)**
- 180 pages
- 2,413 questions
- 2,728 words
- Fully checked, with 2 disclosed notes below (not data loss)

**Running total (both books so far)**
- 404 pages · 4,164 questions · 3,903 words

**Two things to know about Tricolore 1**
- 6 pages have one small decorative element that stayed unreadable even
  after a closer second pass (a blurry photo caption, a stylized cursive
  font on a small ticket graphic, etc.) — never exercise/answer content,
  and everything else on those pages is complete.
- Just under half the questions (1,091) have a blank answer because this
  book's answers are sold separately (teacher's guide), same as Cosmopolite
  A1. A further 196 are open-ended writing/speaking tasks with no single
  answer — marked differently, not counted as blanks. Can revisit if the
  teacher's guide ever becomes available.

**How to use it**
1. `README.md` — explains each column.
2. One book only → open its folder (`cosmopolite-a1-methode/` or
   `tricolore-1-5th-edition/`): its questions, words, page list, and the
   full book `.md`, all together.
3. Everything at once → open `_combined/` (just updated to cover both books).

3 more coursebooks (Tricolore 2, Saison 2, Cosmopolite 5) are in progress and
will be added to this same folder as each finishes.

Best,
Harshan

---

## Re-upload 2026-08-11 — `v1.1.9`, commit `9bd75bd`

**Quote that tag when reporting anything about this data.** It is the only thing
that identifies which extraction produced a given Drive folder, and the same
stamp is written into `_exports/START-HERE.md`.

Superseded every earlier upload. The previous Drive copies predated four columns
and a batch of answer corrections, so they were not merely older -- they were
wrong:

| Added since the last upload | Where |
|---|---|
| `instruction` (exercise rubrics) | questions sheets, both languages |
| `translation`, `gender` | French vocabulary (4,303 translations recovered) |
| `option_d`, `option_e` | questions sheets, both languages |
| 41 corrected answers | German Netzwerk books: letter keys and lowercase true/false terms replaced with full text |

Verified before upload: `verify_exports` and `check_exports_current` pass for
both languages -- the latter for German for the first time, which was impossible
until the forked exporter was retired (gap P1).
