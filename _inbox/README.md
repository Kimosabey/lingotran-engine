# `_inbox/` — the intake inbox

Drop new source material here (PDFs, audio archives, anything else). It is a
**staging area only**: nothing is processed from this folder, and it should be
empty once intake has run.

## The rule: identify before you file

**Step 0 for every new PDF is to establish what the book actually IS and what it
is FOR — before it is moved, renamed, registered, rasterized or transcribed.**
Not from the filename. From the document.

A filename is a guess. It has been wrong before: "Saison 2" was assumed to be
CLE International and is actually Didier. And the intake on `reussir-delf-prim-a1`
found, purely by reading the document, that the file is **missing its last ~20
printed pages** — including an entire mock-exam level the title advertises. That
would have surfaced ~60 pages into a transcription run instead, after the money
was spent.

## What "identify" means — answer all of these, record the evidence

| # | Question | How to answer it |
|---|---|---|
| 1 | **What is it?** Title, authors, publisher, edition | Render page 1 and LOOK at the cover; check the copyright page. Never infer from the filename |
| 2 | **Who is it for?** | Adult learner, child, exam candidate, teacher? |
| 3 | **What does it intend?** Coursebook / workbook / exam prep / reference / word list | Read the table of contents in full — it is the book's own statement of purpose |
| 4 | **What level(s)?** `fixed` or `inferred` | Cover plus a few interior pages, not the title alone |
| 5 | **Is it complete?** | Compare the highest page number in the TOC against the actual page count, and map printed page numbers to PDF pages (they are usually offset) |
| 6 | **Is there a text layer?** | `page.get_text()`. A real one can avoid the vision pipeline entirely — the single biggest cost lever. An OCR layer (ABBYY etc.) must be quality-checked against the images before it is trusted |
| 7 | **Does it print its own answers?** | Search for `corrigé` / `solutions` / `réponses`, and check the TOC and back matter |
| 8 | **Is there companion media?** | Audio/video archives, and whether anything on this machine can actually unpack them |

## Then, and only then

1. Move the PDF to `<language>/pdf/<publisher>/<slug>/<slug>.pdf` and any media to
   `<language>/audio/<publisher>/<slug>/`.
2. Add the collection to `<language>/extracted/_tools/collections.json` with
   `slug`, `family`, `title`, `level`, `level_mode`, `pdf`, `book_type`, and a
   **`recon` block recording the answers above plus the date and what you looked
   at**. Findings that live only in a chat transcript are lost.
3. Record anything already known to be wrong with the source in `caveats`
   immediately — truncation, missing media, bad scans. Do not wait for extraction
   to rediscover it.
4. Leave `status: "registered-not-started"` until extraction actually begins.
5. Empty this folder.

Registering a book does **not** start it. Extraction is a separate, explicitly
confirmed decision, one book at a time — see `_engine/PLAYBOOK.md`.
