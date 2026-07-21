# How the German (Goethe A1) extraction was done

The end-to-end process that turned 7 official Goethe-Institut PDFs into a
verified, queryable learning corpus. Written so it can be **repeated for another
PDF set or another language** without rediscovering anything.

---

## 1. What went in / what came out

**In:** 7 official, free Goethe-Zertifikat A1 practice PDFs from goethe.de
(Start Deutsch 1 ×4, Fit in Deutsch 1 ×3) — downloaded manually, kept gitignored.

**Out:**
- **302 pages** transcribed verbatim + QA-verified (**100%**, 0 failures)
- **247 exam questions** with options + correct answers
- **1,564 vocabulary words** with article/plural/example
- 7 unified documents + 17 filterable sheets

---

## 2. Design principles

| Principle | How it shows up |
| --- | --- |
| **Zero data loss** | Transcription is verbatim (German spelling/umlauts/ß exact); nothing summarised; illegible text marked, never dropped |
| **Adversarial verification** | A second, independent agent hunts for omissions; it never edits — it only judges |
| **Self-healing** | Failed pages go to a repair agent, then get re-verified |
| **Resumable** | `manifest-media.tsv` is the authoritative state; re-runs skip verified pages |
| **Isolation** | German owns its `_tools/`; French and `german/web/` are never touched |
| **Config over code** | Adding a PDF = one entry in `collections.json`, no code change |
| **Local where possible** | Rasterising, manifests, sheets are plain Python; LLM only where judgement is required |

---

## 3. The pipeline

```
 source PDF (german/pdf/…)
      │  pdf_to_images.py  ── PyMuPDF, 300 DPI
      ▼
 <collection>/images/page-NNN.png          (gitignored — regenerable)
      │
      │  transcribe_pdf.workflow.js  ── 3 stages, per page:
      │     ① Transcribe  vision agent reads the page image, self-corrects
      │                   orientation (rotate.py), zooms fine print (zoom.py),
      │                   writes verbatim Markdown + frontmatter
      │     ② QA          independent agent re-reads image vs. transcription,
      │                   adversarially hunts omissions → _qa/page-NNN.json
      │     ③ Repair      only if QA failed: fix every issue, then re-verify
      ▼
 <collection>/pages/page-NNN.md  +  pages/_qa/page-NNN.json
      │  manifest_media.py qa-apply → folds verdicts into frontmatter + manifest
      ▼
 ┌──────────────── enrichment passes (1 agent per collection) ────────────────┐
 │  classify.workflow.js    → activity_type · topic · one-line summary        │
 │  questions.workflow.js   → per-item question · options · correct answer    │
 │                            (cross-referenced against the Lösungen pages)   │
 │  vocabulary.workflow.js  → word · article · plural · example (chunked)     │
 └───────────────────────────────────────────────────────────────────────────┘
      │  catalog.py · questions.py · vocabulary.py   (plain Python, no LLM)
      ▼
 unified <collection>.md   +   *-catalog.csv   *-questions.csv   *-vocabulary.csv
                           +   combined goethe-a1-*-all.csv sheets
```

### Layer by layer

Twelve layers. Each one takes a well-defined input, does exactly one job, and
writes an artifact the next layer reads. Any layer can be re-run on its own.

**Layer 0 — Source acquisition** · manual · *no tool*
Download the official PDFs/audio from goethe.de into `german/pdf/…`.
→ Raw binaries, **gitignored** (regenerable from the public source, and large).
*Why separate:* keeps copyrighted-source handling explicit and out of git.

**Layer 1 — Rasterisation** · `pdf_to_images.py` · **local**
`source.pdf` → `<collection>/images/page-NNN.png` at 300 DPI via PyMuPDF.
*Why:* the transcriber is a **vision** model — it needs pixels, not a text layer.
300 DPI matches the French convention and keeps small print legible.
Images are gitignored (deterministically regenerable).

**Layer 2 — State seeding** · `manifest_media.py init` · **local**
Globs the rendered images + `collections.json` → one row per page in
`manifest-media.tsv` (`status: pending`).
*Why:* this file is the **resume anchor**. Everything downstream reads/updates it,
so an interrupted run never loses its place. Idempotent — won't clobber.

**Layer 3 — Vision transcription** · `transcribe_pdf.workflow.js` ① · **LLM (per page, effort: high)**
Reads `page-NNN.png` → writes `pages/page-NNN.md` (YAML frontmatter + verbatim body).
Self-corrects orientation by shelling out to `rotate.py`; zooms unreadable regions
with `zoom.py`; marks illegible text rather than dropping it; tags `content_type`
and fixed `level: A1`.
*Why per page:* each page is an independent vision task — parallelises cleanly and
a failure is isolated to one page.

**Layer 4 — Adversarial QA** · `transcribe_pdf.workflow.js` ② · **LLM (per page, effort: high)**
A **separate** agent re-reads the image *and* the transcription, assuming an
omission exists until every block is checked → `pages/_qa/page-NNN.json`
(`{ok, missing_count, issues[]}`). **It may not edit the transcription.**
*Why separate + read-only:* an author grading its own work rationalises; an
independent adversarial reader with no write access actually finds omissions.

**Layer 5 — Repair** · `transcribe_pdf.workflow.js` ③ · **LLM (conditional)**
Runs **only** when QA failed. Reads the verdict, fixes each named issue, re-verifies
the whole page, overwrites the verdict.
*Result here:* triggered once in 302 pages (sd1-exam-training-3 p45) and passed.

**Layer 6 — Verdict folding** · `manifest_media.py qa-apply` · **local**
Folds `_qa/*.json` into each page's frontmatter (`status: verified|transcribed`,
`qa: pass|fail`) + appends a `<!-- QA ISSUES -->` block on failure, then syncs the manifest.
*Why:* one place converts judgements into state; the manifest stays authoritative.

**Layer 7 — Unification** · `catalog.py` · **local**
Concatenates every page into one `<collection>.md` (overview + page index + full body)
and emits `<collection>-catalog.csv`.
*Why this sits before enrichment:* layers 8–10 then read **one** file per collection
instead of 47 — dramatically cheaper and gives the agent whole-document context.

**Layer 8 — Classification** · `classify.workflow.js` · **LLM (per collection, effort: low)**
Reads the unified `.md` → `pages/_class.json` with `activity_type`, `topic`,
and a one-line English `summary` per page.
*Why per collection + low effort:* it only needs document-level context, and
labelling is far easier than transcribing.

**Layer 9 — Question extraction** · `questions.workflow.js` · **LLM (per collection, effort: medium)**
Parses every exam item **and cross-references the Lösungen pages** for the correct
answer → `pages/_questions.json`.
*Why per collection:* the questions and their answer key live in the *same* document —
an agent must see both at once to match them.

**Layer 10 — Vocabulary extraction** · `vocabulary.workflow.js` · **LLM (per ~5-page chunk, effort: medium)**
Reads the Wortliste pages → `pages/_vocab/chunk-*.json` (word, article, plural,
word_class, example, topic).
*Why chunked:* a single agent asked for ~800 dense entries truncates its output.
~5 pages per agent was the reliable size.

**Layer 11 — Export generation** · `catalog.py` · `questions.py` · `vocabulary.py` · **local**
Merge the enrichment sidecars with the page frontmatter → the unified `.md`
(now with activity/topic + page index) and the three CSV families, plus the
combined `goethe-a1-*-all.csv` sheets. Written UTF-8 **with BOM** for Excel.
*Why local:* pure data reshaping — deterministic, free, and instantly re-runnable
whenever a page or a sidecar changes.

**Layer 12 — Dashboard** · `manifest_media.py dashboard` · **local**
Regenerates `MANIFEST-MEDIA.md` (totals, per-collection progress, next pending pages).

### At a glance

| Layer | Artifact produced | Kind | Re-runnable alone |
| --- | --- | --- | --- |
| 0 Source | `german/pdf/*.pdf` | manual | yes |
| 1 Rasterise | `images/page-NNN.png` | local | yes |
| 2 Seed | `manifest-media.tsv` | local | yes (idempotent) |
| 3 Transcribe | `pages/page-NNN.md` | **LLM** ×~300 | per page |
| 4 QA | `pages/_qa/page-NNN.json` | **LLM** ×~300 | per page |
| 5 Repair | corrected `.md` + verdict | **LLM** (rare) | per page |
| 6 Fold | frontmatter + manifest state | local | yes |
| 7 Unify | `<collection>.md` | local | yes |
| 8 Classify | `pages/_class.json` | **LLM** ×7 | per collection |
| 9 Questions | `pages/_questions.json` | **LLM** ×7 | per collection |
| 10 Vocabulary | `pages/_vocab/chunk-*.json` | **LLM** ×12 | per chunk |
| 11 Export | unified `.md` + all CSVs | local | yes |
| 12 Dashboard | `MANIFEST-MEDIA.md` | local | yes |

**Cost shape:** layers 3–5 are ~97% of the spend (one high-effort agent pair per
page). Layers 8–10 together are a rounding error (26 agents). Layers 0–2, 6–7,
11–12 are free. So iterating on *outputs* (sheets, docs, taxonomies) never
re-incurs the transcription cost — a deliberate property of the split.

---

## 4. Stack (everything was already installed — zero new dependencies)

| Job | Tool | Why |
| --- | --- | --- |
| PDF → page images | **PyMuPDF (`fitz`)** | Only rasteriser present; no poppler needed |
| Rotate / zoom | **Pillow** (`rotate.py`, `zoom.py`) | Copied verbatim from the French pipeline — already generic |
| Vision transcription, QA, repair, enrichment | **Claude Agent SDK workflows** (`*.workflow.js`) | Judgement work: reading scans, verifying, classifying |
| Manifest, sheets | **plain Python** | Deterministic, free, instant to re-run |
| (audio, out of scope) | faster-whisper + PyAV | Local ASR; parked |

---

## 5. The four LLM workflows

All are `.workflow.js` scripts run via the Workflow tool, all take
`args.root` (no hardcoded paths), all use JSON-Schema structured output.

| Workflow | Granularity | Agents | Notes |
| --- | --- | --- | --- |
| `transcribe_pdf` | **per page** | ~600 | 3 stages; `effort: high`; the expensive pass |
| `classify` | **per collection** | 7 | `effort: low`; reads the unified `.md`, not 47 files |
| `questions` | **per collection** | 7 | `effort: medium`; must cross-reference the answer key |
| `vocabulary` | **per ~5-page chunk** | 12 | `effort: medium`; chunked because word lists are dense |

**Why the granularity differs:** transcription needs one agent per page (each
page is an independent vision task). Classification only needs whole-document
context, so one agent per collection is far cheaper. Vocabulary had to be
*chunked* — a single agent asked for ~800 dense entries would truncate.

---

## 6. Runbook (repeat this for a new PDF set)

```bash
# 0. register the source — the only config step
#    edit _tools/collections.json: add {slug, publisher, exam, level, variant, pdf, audio}

cd german/extracted

# 1. rasterise PDFs → page images
python _tools/pdf_to_images.py --all

# 2. seed the resume state
python _tools/manifest_media.py init

# 3. transcribe + QA + repair (per collection; batch the page list)
#    Workflow tool:
#      scriptPath: german/extracted/_tools/transcribe_pdf.workflow.js
#      args: { root:"<abs>/german/extracted", collection:"<slug>",
#              src:"<file>.pdf", level:"A1", pages:[1..N] }

# 4. fold QA verdicts into frontmatter + manifest
python _tools/manifest_media.py qa-apply

# 5. build the unified docs + page sheets (needed before enrichment —
#    classify/questions read the unified .md)
python _tools/catalog.py --all

# 6. enrichment passes (Workflow tool, args: { root, collections:[…] })
#      _tools/classify.workflow.js       → pages/_class.json
#      _tools/questions.workflow.js      → pages/_questions.json
#      _tools/vocabulary.workflow.js     → pages/_vocab/chunk-*.json
#        (vocabulary takes args.tasks:[{slug, pages:[…]}] — ~5 pages per chunk)

# 7. regenerate every deliverable
python _tools/catalog.py --all
python _tools/questions.py --all
python _tools/vocabulary.py --all
python _tools/manifest_media.py dashboard
```

Steps 1, 2, 4, 5, 7 are free/local. Only step 3 is expensive; steps 6 are cheap.

---

## 7. Verification performed

- **Per page:** adversarial QA agent → `_qa/page-NNN.json` (`ok`, `missing_count`, `issues[]`).
  Result: **302/302 verified, 0 failures**, 1 page auto-repaired (sd1-exam-training-3 p45).
- **Coverage check:** cross-referenced every page classified `vocabulary` against the
  extracted word rows. 6 pages yielded zero words — inspected each, all were
  *"INVENTARE"* pages (thematic/grammar inventories, not headword lists). Confirmed
  correct, not under-extraction.
- **Encoding:** CSVs written UTF-8 **with BOM** so Excel renders umlauts on
  double-click; asserted `Dreißig`/`Fünfundneunzig`/`möchten` survive round-trip.
- **Isolation:** `git status` confirmed French, `german/web/`, the web
  `manifest.tsv` and `deutsch-pruefung/` corpus were never modified.

---

## 8. Gotchas worth remembering

1. **A `**/` inside a JSDoc/`/** */` block comment closes it early** — cost a
   confusing parse error in a schema file. Avoid glob patterns in block comments.
2. **The French workflow hardcoded an absolute ROOT path** and was not runnable
   as-is. The German version takes `args.root` — do the same for future languages.
3. **Readonly model fields** — build objects immutably; don't mutate typed structs.
4. **Chunk dense extractions.** One agent per ~800-entry word list truncates;
   ~5 pages per agent was reliable.
5. **Generate the unified `.md` before enrichment** — classify/questions/vocabulary
   read it instead of dozens of page files, which is much cheaper.
6. **A failed agent may still have written its output.** One `questions` agent hit a
   session limit and was reported failed, but its file was complete — check before re-running.
7. **Excel needs the BOM.** Plain UTF-8 CSV shows mojibake on double-click in Windows.

---

## 9. Not included

- **Audio/listening transcripts** — deliberately out of scope (one sample exists).
- **Topic/activity taxonomies are LLM-assigned**, not from the source documents;
  they're navigation aids, not official Goethe metadata.
- **Open-ended Schreiben/Sprechen items have no correct answer** — no official key
  exists for them; they carry `(open-ended)`.
