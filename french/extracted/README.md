# French A1/A2 — Extracted content

Lossless Markdown extraction of two scanned French practice books, for ingestion into the
**lingotran** language-learning platform. **Goal: zero data loss** — every heading, instruction,
table, exercise, blank, example, answer key, caption and page number is captured verbatim.

## Books
| Folder | Source PDF | Pages (scanned spreads) |
|---|---|---|
| `conjugaison-a1-a2/` | PRATIQUE-CONJUGASION A1 A2.pdf | 106 |
| `revision-2/` | Pratique Révision 2.pdf | 181 |

Both PDFs are **scanned images with no text layer**, so content is recovered by Claude-vision
transcription. Each scanned page is a **two-page book spread** (left + right), rendered to PNG at
**300 DPI**.

## Layout
```
extracted/
  README.md            ← this file
  MANIFEST.md          ← progress dashboard (regenerated from manifest.tsv)
  manifest.tsv         ← AUTHORITATIVE per-page state (resume anchor)
  _tools/manifest.py   ← init / regenerate-dashboard helper
  <book>/
    README.md          ← book overview + full table of contents (taxonomy)
    images/  page-NNN.png   ← 300-DPI render, 1:1 with the PDF (canonical visual source)
    pages/   page-NNN.md     ← faithful per-page transcription (1:1 with image) + frontmatter
    sections/A1/… A2/…       ← content reorganized by inferred CEFR level, then topic
```

## Per-page Markdown
`pages/page-NNN.md` is the canonical, verbatim transcription of one scanned spread (clearly
splitting the left/right book pages with their printed page numbers). Frontmatter records
`source, page, orientation, content_type, level (inferred), section, status, qa`.

## A1/A2 separation
The source PDFs **do not mark level** per exercise (they are organized by topic; "A1 A2" is only
the book's overall CEFR scope). Per the project decision, level is **inferred per exercise** during
transcription and marked `level: A1 (inferred)` / `A2 (inferred)`. `pages/` stays 100% faithful
(no injected level); the `sections/A1/` and `sections/A2/` trees are built from the inferred tags.

## Resuming (multi-session)
The job spans multiple chats. To continue: open `MANIFEST.md`, then process every page whose
`status` ≠ `verified` through transcription → QA, updating `manifest.tsv`. Re-run
`python _tools/manifest.py dashboard` to refresh `MANIFEST.md`.

## Verification (no-data-loss gate)
- `images/` count == PDF page count == `pages/*.md` count (106 and 181).
- Every `manifest.tsv` row reaches `status=verified, qa=pass`.
- Every page is mapped to exactly one `sections/` file (coverage check).
- Zero unresolved `<!-- illegible -->` markers.
