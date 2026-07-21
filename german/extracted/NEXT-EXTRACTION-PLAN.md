# Next extraction — plan (textbook batch)

Three new German sources, organised and ready. This is the plan to run them
through the pipeline. Process reference: [`EXTRACTION-WORKFLOW.md`](./EXTRACTION-WORKFLOW.md).

---

## 1. The sources (already foldered)

| Folder | Pages | Type | Proposed slug |
| --- | --- | --- | --- |
| `pdf/goyal/a1-young-learners/young-learners.pdf` | **104** | scanned | `goyal-a1-young-learners` |
| `pdf/klett-netzwerk-neu/a1-chapterwise-test-booklet/chapterwise-test-booklet.pdf` | **56** | scanned | `netzwerk-a1-test-booklet` |
| `pdf/klett-netzwerk-neu/a1-kursbuch/kursbuch.pdf` | **174** | scanned | `netzwerk-a1-kursbuch` |

**334 pages total** (vs. 302 for the whole Goethe batch).

⚠️ **These are commercial textbooks**, unlike the Goethe set (official free
practice material). Treat the output as internal/personal study material — not
for redistribution. Raw PDFs stay gitignored, same as today.

---

## 2. What's different from the Goethe run (this is the important part)

**All three are SCANNED / image-only — no text layer.** The Goethe PDFs were
born-digital. Consequences:

| Aspect | Goethe (done) | This batch |
| --- | --- | --- |
| Orientation | almost always 0 | **expect rotated pages** → `rotate.py` will actually fire |
| Small print | rarely needed zoom | **expect `zoom.py` use** on scan artifacts |
| QA repair rate | 1 page in 302 | **expect materially higher** — budget for repair passes |
| Content shape | exam papers | **textbook + coursebook** (lessons, not just tasks) |

**Content type vocabulary must be extended.** A Kursbuch is not an exam paper.
Add (to `transcribe_pdf.workflow.js`): `lesson`, `grammar-box`, `dialogue`,
`audio-script`, `wordlist`, `chapter-opener`, `review` — keeping the existing
`exercise / instructions / reading-text / answer-key / cover / toc / intro`.

**Question extraction applies unevenly:**
- `netzwerk-a1-test-booklet` → **yes**, it's a test booklet (best candidate; check for a Lösungen section).
- `netzwerk-a1-kursbuch` → **partial** — has exercises, but a coursebook's answer key may be in a separate Arbeitsbuch we don't have. Expect many items with a blank `correct_answer`.
- `goyal-a1-young-learners` → **inspect first**; likely exercises + wordlists.

**Vocabulary extraction:** Netzwerk chapters usually end in a Wortschatz/wordlist,
and Goyal young-learner books are vocabulary-heavy → run `vocabulary.workflow.js`
on the wordlist page ranges once we know where they are.

---

## 3. Order of work (tomorrow)

**Step 0 — recon (do this first, 5 min, cheap).**
Rasterise a handful of pages from each PDF and eyeball them: orientation, scan
quality, and where chapters/wordlists/answer keys sit. This decides the
content_type list and the vocabulary page ranges before spending on 334 pages.

```bash
cd german/extracted
python _tools/pdf_to_images.py --all        # after step 1 registers them
```

**Step 1 — register the sources.** Add three entries to `_tools/collections.json`
(slug, publisher, exam:"", level, variant, pdf, audio:null).
⚠️ `exam` should be `""`/`none` for textbooks — they're not tied to an exam board.
⚠️ Confirm the level for the Goyal book (assumed A1 — verify from the cover).

**Step 2 — extend the vocabulary** in `transcribe_pdf.workflow.js` (content types
above) and relax the prompt's exam-paper framing for textbook pages.

**Step 3 — rasterise + seed.**
```bash
python _tools/pdf_to_images.py --all
python _tools/manifest_media.py init        # idempotent; adds only new rows
```

**Step 4 — transcribe, smallest first** (validate the prompt changes cheaply):
1. `netzwerk-a1-test-booklet` (56 pp) — check output, tune prompt if needed
2. `goyal-a1-young-learners` (104 pp)
3. `netzwerk-a1-kursbuch` (174 pp)

Run 2 collections concurrently, ~45–50 pages per Workflow invocation.

**Step 5 — fold verdicts + inspect repairs.**
```bash
python _tools/manifest_media.py qa-apply
```
Scanned sources will surface real repairs here — read a few before moving on.

**Step 6 — unify, then enrich.**
```bash
python _tools/catalog.py --all
```
then the Workflow passes: `classify` → `questions` (test booklet + kursbuch only)
→ `vocabulary` (wordlist page ranges only).

**Step 7 — export + commit.**
```bash
python _tools/catalog.py --all && python _tools/questions.py --all
python _tools/vocabulary.py --all && python _tools/manifest_media.py dashboard
```

---

## 4. Estimates

| | |
| --- | --- |
| Pages | 334 |
| Wall clock | **~50–70 min** at 2 concurrent batches (scans are slower; repairs add passes) |
| Cost | **~18–22M tokens** — layers 3–5 dominate, as before |
| Cheap layers | recon, rasterise, manifest, catalogs, sheets — all free/local |

Enrichment (classify/questions/vocabulary) is a rounding error, so taxonomy
changes are cheap to iterate after the fact.

---

## 5. Open questions to settle before Step 4

1. **Goyal level** — is "German for young learners" A1, or pre-A1? Affects `level`.
2. **Kursbuch answer key** — is there a matching Arbeitsbuch/Lösungen PDF? Without it,
   `correct_answer` will be blank for most Kursbuch items (still useful, but worth knowing).
3. **Kursbuch scope** — transcribe all 174 pages, or only the exercise/wordlist
   chapters? Full run is the default unless you'd rather target.
4. **Audio** — any companion audio for these? Currently `audio: null` for all three.

---

## 6. Deferred from the Goethe batch

- Audio: 3/5 listening files transcribed (sd1 et1/et2/et3). `fit1` et1/et2 remain —
  one command: `python _tools/transcribe_audio.py goethe-a1-fit1-exam-training-1 goethe-a1-fit1-exam-training-2`
- Backup: raw PDFs/audio (~99 MB) and rendered images (~73 MB) are gitignored.
  The Goethe sources are re-downloadable from goethe.de; **these three textbooks are
  not** — they exist only on this machine, so they need a real off-machine backup.
