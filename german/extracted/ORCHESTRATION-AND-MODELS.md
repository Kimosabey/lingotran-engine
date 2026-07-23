# Orchestration & Models — how the Lingotran engine runs, and what it costs

*Internal engineering note. Plain English. Covers: who does what, which model is
used where and why, whether it's efficient, an honest cost critique, and a leaner
+ more robust design.*

---

## 1. What the engine does (one line)

Turn a scanned or digital language-learning PDF into clean, checked, structured
study data (typed-out pages + question bank + word lists + filterable sheets),
**losing nothing**.

---

## 2. The orchestra — who plays what

Think of it as a small team. Only a few members are expensive "thinkers"; the
rest are cheap, reliable "machines."

| Player | Role | Uses a model? | Cost |
|---|---|---|---|
| **Rasteriser** (`pdf_to_images.py`) | PDF → one PNG per page (300 DPI) | No — Python (PyMuPDF) | ~free |
| **Transcriber** | *Looks at* a page image, types every word | **Yes — vision model** | 💰💰💰 expensive |
| **QA checker** | *Looks at the same image again*, hunts for anything missed | **Yes — vision model** | 💰💰💰 expensive |
| **Repairer** | Fixes only the pages QA flagged | **Yes — vision model** | 💰 rare |
| **Classifier** | Reads the typed text, tags topic/activity | **Yes — text model** | 💰 cheap |
| **Question extractor** | Reads the typed text, pulls out Q + answer | **Yes — text model** | 💰 cheap |
| **Vocabulary extractor** | Reads word-list pages, pulls out word + article + plural | **Yes — text model** | 💰 cheap |
| **Packager** (`catalog.py`, `questions.py`, `vocabulary.py`, `merge_all.py`, `manifest_media.py`) | Builds CSVs, unified docs, dashboard | No — Python | ~free |

**Rule of thumb:** the engine only spends money where a human would need *eyes*
(reading a scan) or *judgement* (finding an omission, classifying). Everything
that is just moving data around is plain Python and costs nothing.

### Which model for which job

- **Vision jobs (transcribe / QA / repair)** → a **strong model that can see
  images**. **Opus 4.8** is best here — scans are messy (skew, faint pencil,
  rotated pages), and accuracy matters most on this step because everything else
  is built on top of it.
- **Text jobs (classify / questions / vocabulary)** → these only read the
  *already-typed* Markdown, so a **cheap, fast model (Haiku or Sonnet)** is
  plenty. This enrichment run was done on **Sonnet** with no quality loss.
- **Python jobs** → no model.

**Example — one page's journey (Netzwerk Kursbuch, page 66, a WhatsApp-style chat):**
1. `pdf_to_images.py` renders `page-066.png` (free).
2. Opus 4.8 *reads the picture*, sees the 12 chat bubbles in two columns, types
   them in order + the grammar box → `page-066.md` (expensive vision).
3. Opus 4.8 *reads the picture again* as a sceptic → confirms nothing dropped →
   `_qa/page-066.json {ok:true}` (expensive vision, second time).
4. Sonnet *reads the text file* → tags it `dialogue, topic: communication` and
   pulls out the exercise items (cheap text).
5. Python folds it into the CSVs + dashboard (free).

---

## 3. Is it efficient — or expensive? (honest answer)

**Honest answer: it is thorough and safe, but it is token-expensive — and a big
slice of that spend is avoidable.** Two separate things:

- **Necessary cost:** reading a scanned image with a vision model is just
  expensive, full stop. There's no free way to read a true scan.
- **Avoidable cost:** we paid for the same work more than once this project
  (see the critique). *That* is where the waste is.

### Where the tokens actually go

```
Transcription (read image + type)          ~45%  ── unavoidable for real scans
QA (read the SAME image again)              ~35%  ── the biggest "is it worth it?" cost
Repair (fix flagged pages)                   ~2%
Enrichment (classify+questions+vocab, text) ~8%   ── cheap, on a small model
Wasted re-runs (died mid-work, relaunched)  ~10%  ── pure loss, avoidable
Python (raster, sheets, dashboard)           ~0%
```

The headline: **transcription + QA together are ~80% of spend, and QA alone
(~35%) is a full second pass over every image.** That's the deliberate price of
the zero-data-loss guarantee — but it's also the first place to look for savings.

---

## 4. Critique — what's wasteful (and why it happened)

1. **QA re-reads the whole image for every page.** Doubling the vision cost to
   catch omissions is a strong guarantee, but on clean, simple pages (covers,
   tables of contents, easy wordlists) it rarely finds anything. We paid full
   price for QA on 636 pages; a large share were "nothing to fix."
2. **We never checked for a text layer.** Digital-born PDFs (the Goethe set looks
   digital, not scanned) often already contain selectable text. If so, that text
   can be pulled out with **Python for free** — no vision model at all. We
   vision-transcribed everything, which is the right call for the 3 *scanned*
   textbooks but likely overkill for digital PDFs.
3. **Wasted re-runs (~10%).** Account switches, `529 overload`, session and
   credit limits repeatedly killed agents *after* they'd read the images but
   *before* they wrote the file — so that spend produced nothing and we relaunched.
   The whole enrichment wave got wiped once and rerun.
4. **Agent-loop fallback overhead.** Because the Workflow tool was off, each
   batch was a fresh sub-agent that re-read the shared instruction file and
   re-established context. The Workflow pipeline avoids that (structured output,
   one setup, resumable by run-id).
5. **`effort: high` on all vision work.** Fine for dense scans; wasteful on a
   plain wordlist or a cover page.
6. **Enrichment read each page up to 3×** (once per pass) before we merged
   classify+questions into one pass. Vocabulary is still a separate read.

---

## 5. The leaner + more robust design (recommended)

Ordered by biggest saving first.

1. **Detect a text layer before rasterising.** For each PDF, try
   `page.get_text()` (PyMuPDF). If a page has real, well-ordered text →
   **use it directly (free), skip vision entirely**; only rasterise + vision the
   pages that are genuine images/scans. *Potential saving: enormous on digital
   PDFs — could remove the transcription cost for a whole book.*
2. **Tier QA instead of always full-re-read.**
   - Auto-pass "trivial" pages (cover/TOC/blank) with a cheap text check.
   - Run the full adversarial image-QA only on content pages (exercises, dense
     tables, answer keys) — where omissions actually hide.
   - *Saving: cut the ~35% QA slice roughly in half with no real quality risk.*
3. **Right-size the model + effort per page.** Opus 4.8 + high effort for hard
   scans; Sonnet / lower effort for clean pages and wordlists. Drive it off
   `content_type` and an "illegible?" flag.
4. **One-pass enrichment.** A single text agent per page-range emits
   classify + questions + vocabulary together (one read, three outputs) instead
   of three reads. *Saving: ~2× on the (already cheap) enrichment.*
5. **Use the Workflow tool when available.** Structured pipeline, one setup,
   `resumeFromRunId` replays cached results instantly — no re-reading
   instructions, far less "died mid-wave" waste.
6. **Run heavy waves on a fresh session/account.** The #1 avoidable loss was
   launching 15-20 expensive agents into a nearly-exhausted account and having
   them die mid-work. Check headroom first; keep batches to ~5-6 vision pages so
   a death costs little and resume is cheap. (Resume already works — it's driven
   off disk truth in `manifest-media.tsv`.)
7. **Keep the cheap safety nets we already have:** per-page atomic writes, the
   manifest as resume anchor, `frozen` collections, UTF-8-BOM CSVs. These made
   the messy runs recoverable — they are the "robust" half and should stay.

### What "efficient + robust" looks like end-to-end

```
PDF ─▶ text-layer? ──yes──▶ extract text (Python, FREE) ─▶ page.md
          │no
          ▼
      rasterise ─▶ vision transcribe (Opus, sized effort)
          ▼
      QA: trivial page? ─yes─▶ cheap auto-pass
          │no
          ▼
      adversarial image-QA (Opus) ─▶ repair if needed
          ▼
      ONE text pass (Sonnet/Haiku): classify + questions + vocab
          ▼
      Python: sheets + combined + dashboard   (FREE)
```

**Net effect:** same zero-loss guarantee on the pages that actually need it,
but the free/cheap paths carry most of the load — realistically a large cut in
tokens versus "vision + full-QA on every page."

---

## 6. One-line verdict

The engine is **correct and safe, and its cost is dominated by two things:
reading scans (unavoidable) and re-reading them for QA + re-running killed agents
(largely avoidable).** Add text-layer detection, tier the QA, size the model to
the page, and run on fresh sessions — and it becomes both cheap *and* robust,
without giving up zero-data-loss.
