# How the German A1 extraction was done

The end-to-end process that turned **10 source documents** — 7 official
Goethe-Institut exam PDFs **and 3 scanned A1 textbooks** — into a verified,
queryable learning corpus. Written so it can be **repeated for another PDF set or
another language** without rediscovering anything. The pipeline is
**publisher-agnostic**: a new book is one entry in `collections.json`, no code change.

---

## 1. What went in / what came out

**In (10 collections):**
- **Goethe-Zertifikat A1** — 7 official, free practice PDFs from goethe.de
  (Start Deutsch 1 ×4, Fit in Deutsch 1 ×3). *Delivered earlier and now **frozen**.*
- **Netzwerk neu A1** (Klett) — **Kursbuch** (174 pp) + chapterwise **Test Booklet** (56 pp), scanned.
- **German for Young Learners A1** (Goyal) — 104 pp, scanned.

All source PDFs/audio downloaded manually, kept **gitignored**.

**Out:**
- **636 pages** transcribed verbatim + QA-verified (**100%**, zero data loss)
- **2,584 exam/exercise questions** (options + correct answer where a key exists)
- **3,751 vocabulary words** (article · plural · word-class · example)
- 10 unified documents + per-collection / per-publisher / global filterable sheets
- a packaged, publisher-grouped **`_exports/`** delivery tree (see Layer 13)

Per book: Goethe 302 pp / 247 Q / 1,564 W · Netzwerk Kursbuch 174 pp / 1,119 Q /
1,971 W · Netzwerk Test Booklet 56 pp / 415 Q / 98 W · Goyal 104 pp / 803 Q / 118 W.

---

## 2. Design principles

| Principle | How it shows up |
| --- | --- |
| **Zero data loss** | Transcription is verbatim (German spelling/umlauts/ß exact); nothing summarised; illegible text marked, never dropped |
| **Adversarial verification** | A second, independent pass hunts for omissions; it never edits — it only judges |
| **Self-healing** | Failed pages go to a repair pass, then get re-verified |
| **Resumable from disk truth** | Every page/chunk is written atomically; pending work is recomputed from what's on disk, so account switches / limits / outages never lose or double work |
| **Publisher-agnostic** | Nothing is hardcoded to a publisher; `family`/`title`/`source_note` come from `collections.json` |
| **Frozen deliverables** | A collection marked `"frozen": true` (the delivered Goethe set) is never re-extracted or rewritten; exporters skip it and only *read* its combined sheets |
| **Isolation** | German owns its `_tools/`; French and `german/web/` are never touched |
| **Config over code** | Adding a book = one entry in `collections.json` |
| **Local where possible** | Rasterising, manifests, sheets, packaging are plain Python; LLM only where judgement is required |

---

## 3. The pipeline

```
 source PDF (german/pdf/…)
      │  pdf_to_images.py  ── PyMuPDF, 300 DPI
      ▼
 <collection>/images/page-NNN.png          (gitignored — regenerable)
      │
      │  vision transcription — 3 stages, per page:
      │     ① Transcribe  reads the page image, self-corrects orientation
      │                   (rotate.py), zooms fine print (zoom.py), writes
      │                   verbatim Markdown + frontmatter
      │     ② QA          independent pass re-reads image vs. transcription,
      │                   adversarially hunts omissions → _qa/page-NNN.json
      │     ③ Repair      only if QA failed: fix every issue, then re-verify
      ▼
 <collection>/pages/page-NNN.md  +  pages/_qa/page-NNN.json
      │  manifest_media.py qa-apply → folds verdicts into frontmatter + manifest
      ▼
 ┌──────────────────────── enrichment passes ────────────────────────┐
 │  classify   → activity_type · topic · one-line summary             │
 │  questions  → per-item question · options · correct answer         │
 │               (cross-referenced against the Lösungen when present) │
 │  vocabulary → word · article · plural · word_class · example       │
 └────────────────────────────────────────────────────────────────────┘
      │  merge_enrich.py (chunks → _class.json/_questions.json)
      │  catalog.py · questions.py · vocabulary.py · merge_all.py  (plain Python)
      ▼
 unified <collection>.md  +  *-catalog/-questions/-vocabulary.csv
   +  per-family <publisher>-a1-*-all.csv  +  global german-a1-*-all.csv
      │  package_exports.py
      ▼
 _exports/  (publisher-grouped delivery tree — the folder you ship)
```

### Two execution engines (same logic)

The vision + enrichment work is **judgement work done by Claude**. It can run two ways:

- **Workflow tool** (`*.workflow.js`, the original engine) — deterministic
  fan-out/pipeline orchestration, JSON-Schema structured output. Used for the Goethe set.
- **Agent-loop fallback** — when the Workflow tool is unavailable, the *same*
  procedures live as Markdown playbooks in `_tools/` (`agent_transcribe.md`,
  `agent_enrich.md`, `agent_vocab.md`) and are driven by per-range subagents.
  Used for the 3 textbooks. Because every page/chunk is written atomically and
  pending work is recomputed from disk, this survived **multiple account switches,
  a 529-overload storm and credit resets with zero loss** — the run simply
  re-derives the gap set and continues.

### Layer by layer

**Layer 0 — Source acquisition** · manual · *no tool.* Download PDFs/audio into
`german/pdf/…`. Raw binaries, **gitignored** (regenerable from the public source, large).

**Layer 1 — Rasterisation** · `pdf_to_images.py` · **local.** `source.pdf` →
`<collection>/images/page-NNN.png` at 300 DPI via PyMuPDF. The transcriber is a
**vision** model — it needs pixels, not a text layer. Scans may be skewed/rotated.

**Layer 2 — State seeding** · `manifest_media.py init` · **local.** One row per
page in `manifest-media.tsv` (`status: pending`) — the **resume anchor**. Idempotent.

**Layer 3 — Vision transcription** · ① · **LLM (per page).** Reads `page-NNN.png`
→ `pages/page-NNN.md` (frontmatter + verbatim body). Self-corrects orientation,
zooms unreadable regions, marks illegible text rather than dropping it, tags
`content_type` and fixed `level: A1`.

**Layer 4 — Adversarial QA** · ② · **LLM (per page).** A **separate** read-only
pass re-reads image *and* transcription, assuming an omission exists until every
block is checked → `_qa/page-NNN.json` (`{ok, missing_count, issues[]}`).

**Layer 5 — Repair** · ③ · **LLM (conditional).** Runs only when QA failed; fixes
each named issue, re-verifies, overwrites the verdict.

**Layer 6 — Verdict folding** · `manifest_media.py qa-apply` · **local.** Folds
`_qa/*.json` into frontmatter (`status`, `qa`) and syncs the manifest.

**Layer 7 — Unification** · `catalog.py` · **local.** Concatenates every page into
one `<collection>.md` and emits `<collection>-catalog.csv`. Sits before enrichment
so the classify/questions passes read **one** file per collection, not dozens.

**Layer 8 — Classification** · **LLM.** `activity_type`, `topic`, one-line
`summary` per page → `pages/_class.json` (via `_class/chunk-*.json` in the agent-loop).

**Layer 9 — Question extraction** · **LLM.** Every exercise/exam item →
`pages/_questions.json`; `correct_answer` filled from the Lösungen where a key
exists, `(open-ended)` for free writing/speaking, blank when only audio resolves it.

**Layer 10 — Vocabulary extraction** · **LLM (chunked).** Wortliste/Wortschatz
pages → `pages/_vocab/chunk-*.json`. Chunked because dense lists (~800 entries)
truncate a single agent. The Netzwerk A1 back-matter Wortliste (A–Z) alone yielded ~2,080 entries.

**Layer 11 — Merge sidecars** · `merge_enrich.py` · **local.** Assembles the
per-range `_class`/`_questions` chunks into the single `_class.json` /
`_questions.json` the exporters read. (Vocabulary already reads chunks directly.)

**Layer 12 — Export generation** · `catalog.py` · `questions.py` · `vocabulary.py`
· `merge_all.py` · **local.** Per-collection sheets + per-family
`<publisher>-a1-*-all.csv` + global `german-a1-*-all.csv`. UTF-8 **with BOM** for
Excel. `merge_all.py` builds the globals by concatenating the per-family sheets
read-only, so the **frozen Goethe files are never rewritten**.

**Layer 13 — Packaging** · `package_exports.py` · **local.** Non-destructive copy
into `_exports/` — `_combined/` roll-ups + `<publisher>/<book>/` folders + a
README. This is the folder shipped to the content team / Drive.

**Layer 14 — Dashboard** · `manifest_media.py dashboard` · **local.** Regenerates
`MANIFEST-MEDIA.md`. The public site (`site/`) reads its numbers from
`site/assets/js/data.js`.

**Cost shape:** transcription (layers 3–5) is ~95% of the spend — one high-effort
agent pair per page. Enrichment is text-only over the already-written `.md` (no
vision) — much cheaper. Everything else is free/local, so iterating on *outputs*
never re-incurs transcription cost.

---

## 4. Stack (zero new runtime dependencies)

| Job | Tool | Why |
| --- | --- | --- |
| PDF → page images | **PyMuPDF (`fitz`)** | Only rasteriser present; no poppler needed |
| Rotate / zoom | **Pillow** (`rotate.py`, `zoom.py`) | Generic image ops for orientation + fine print |
| Vision transcription, QA, repair, enrichment | **Claude** — Workflow tool *or* Agent-loop playbooks | Judgement work: reading scans, verifying, classifying |
| Manifest, merge, sheets, packaging | **plain Python** | Deterministic, free, instant to re-run |
| (audio, parked) | faster-whisper + PyAV | Local ASR; out of scope |

---

## 5. The extraction passes

Each pass exists both as a Workflow script (`*.workflow.js`, `args.root`,
JSON-Schema output) and as an Agent-loop playbook (`_tools/agent_*.md`) doing the
identical job when the Workflow tool is unavailable.

| Pass | Granularity | Notes |
| --- | --- | --- |
| transcribe | **per page** | 3 stages; `effort: high`; the expensive vision pass |
| classify | per page (batched by range) | activity_type · topic · summary |
| questions | per page (batched by range) | granular per-item; reads any Lösungen in-book |
| vocabulary | **per ~5-page chunk** | chunked because word lists are dense |

**Why granularity differs:** transcription is an independent vision task per page.
Classification/questions are cheap text reads batched ~18 pages per agent.
Vocabulary is chunked so dense A–Z lists don't truncate.

---

## 6. Runbook (repeat this for a new book)

```bash
# 0. register the source — the only config step
#    edit _tools/collections.json: add {slug, family, publisher, level, title,
#    source_note, pdf, audio, frozen:false}

cd german/extracted

python _tools/pdf_to_images.py <slug>        # 1. rasterise → page images
python _tools/manifest_media.py init         # 2. seed resume state (idempotent)

# 3. transcribe + QA + repair — Workflow tool (transcribe_pdf.workflow.js) OR
#    Agent-loop: per-range subagents following _tools/agent_transcribe.md
python _tools/manifest_media.py qa-apply     # 4. fold verdicts → frontmatter + manifest
python _tools/catalog.py <slug>              # 5. unified .md + catalog (before enrichment)

# 6. enrichment — Workflow tool OR Agent-loop (_tools/agent_enrich.md, agent_vocab.md):
#      classify + questions → pages/_class/ , _questions/ chunks
#      vocabulary           → pages/_vocab/chunk-*.json  (word-list pages only)
python _tools/merge_enrich.py <slug>         # chunks → _class.json / _questions.json

# 7. regenerate every deliverable
python _tools/catalog.py <slug>
python _tools/questions.py <slug>
python _tools/vocabulary.py <slug>
python _tools/merge_all.py                   # refresh global german-a1-*-all.csv
python _tools/package_exports.py             # rebuild the _exports/ delivery tree
python _tools/manifest_media.py dashboard
```

Only step 3 (and, lighter, step 6) costs tokens; everything else is free/local.
**Never run a bare `--all`** on the exporters if it would touch a `frozen`
collection — pass explicit slugs (frozen ones are skipped anyway).

---

## 7. Verification performed

- **Per page:** adversarial QA → `_qa/page-NNN.json`. Result: **636/636 verified,
  zero data loss** across all 10 collections. The final gate re-scans every page
  1..N in each book and re-queues anything missing/failed until the pending set is empty.
- **Two source-limited pages** (Goyal p13, p16): all *printed* textbook content is
  fully transcribed; a **previous student's erased pencil answers** are partly
  illegible — best-guessed and flagged inline (documented in the QA sidecar), not
  silently dropped. Not published material.
- **CSV integrity:** all deliverable CSVs checked for BOM + zero ragged rows;
  umlauts asserted to survive round-trip (`Dreißig`, `Fünfundneunzig`, `möchten`).
- **Goethe frozen:** `git diff` confirmed **no** `goethe-a1-*` `.md`/`.csv`
  artifact changed since delivery.
- **Isolation:** French, `german/web/`, and the web `manifest.tsv` never modified.

---

## 8. Gotchas worth remembering

1. **Resume from disk truth, not from agent reports.** Agents die on limits/outages
   mid-write; recompute the pending set by globbing what's actually on disk (both
   `page-NNN.md` **and** `_qa/page-NNN.json`, valid JSON) and re-run only the gaps.
2. **A failed agent may still have written its output** — and a killed one may have
   written it in its final step. Always re-check disk before re-running.
3. **Atomic per-item writes make everything survivable.** Multiple account switches,
   a 529-overload storm and a credit reset cost zero data because each page/chunk
   is one self-contained file.
4. **Concurrency cap is 20 subagents** — launch in waves and refill as slots free.
5. **Chunk dense extractions.** One agent per ~800-entry word list truncates;
   ~5 pages per agent is reliable.
6. **Generate the unified `.md` / enrich from text before vision isn't needed** —
   classify/questions read the already-written `.md` (no image), which is cheap.
7. **Excel needs the BOM.** Plain UTF-8 CSV shows mojibake on double-click in Windows.
8. **A `**/` inside a `/** */` block comment closes it early** — avoid glob patterns there.
9. **Keep delivered outputs frozen** via a `collections.json` flag; build globals by
   *merging* per-family sheets read-only, never a blanket regenerate.

---

## 9. Not included

- **Audio/listening transcripts** — deliberately out of scope (one sample exists).
- **Topic/activity taxonomies are LLM-assigned**, not from the source documents;
  they're navigation aids, not official metadata.
- **Open-ended Schreiben/Sprechen items have no correct answer** — no official key
  exists for them; they carry `(open-ended)`. Items resolvable only from audio
  carry a blank `correct_answer`.
