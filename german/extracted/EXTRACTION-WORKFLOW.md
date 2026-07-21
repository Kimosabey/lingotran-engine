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
