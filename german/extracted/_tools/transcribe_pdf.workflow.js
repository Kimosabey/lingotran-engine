export const meta = {
  name: 'transcribe-german-pdf-pages',
  description: 'Zero-loss vision transcription + adversarial QA + repair of German A1 learning-material pages',
  phases: [
    { title: 'Transcribe', detail: 'orientation self-correct + faithful Markdown (fixed level A1)' },
    { title: 'QA', detail: 'independent omission check; write verdict sidecar' },
    { title: 'Repair', detail: 'fix QA-failed pages and re-verify' },
  ],
}

// --- args (paths resolved from args.root — NO hardcoded absolute path) ---
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) {} }
A = A || {}
const ROOT = String(A.root || '').replace(/[\\/]+$/, '')   // absolute path to german/extracted
const COLLECTION = A.collection                            // e.g. 'goethe-a1-sd1-exam-training-1'
const SRC = A.src                                          // source PDF filename (for frontmatter)
const LEVEL = A.level || 'A1'
let PAGES = A.pages
if (typeof PAGES === 'string') { try { PAGES = JSON.parse(PAGES) } catch (e) {} }
if (Array.isArray(PAGES)) PAGES = PAGES.map(Number)
log(`args: root=${ROOT} collection=${COLLECTION} src=${SRC} level=${LEVEL} pages=${Array.isArray(PAGES) ? PAGES.length + ' pages' : typeof PAGES}`)
if (!ROOT) throw new Error('args.root (absolute path to german/extracted) is required')
if (!COLLECTION) throw new Error('args.collection is required')
if (!Array.isArray(PAGES)) throw new Error('PAGES not an array; got ' + JSON.stringify(A))

const pad = n => String(n).padStart(3, '0')
const img = pg => `${ROOT}/${COLLECTION}/images/page-${pad(pg)}.png`
const mdp = pg => `${ROOT}/${COLLECTION}/pages/page-${pad(pg)}.md`
const side = pg => `${ROOT}/${COLLECTION}/pages/_qa/page-${pad(pg)}.json`
const ROTATE = `${ROOT}/_tools/rotate.py`
const ZOOM = `${ROOT}/_tools/zoom.py`

const TX_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    page: { type: 'integer' },
    orientation: { type: 'integer', enum: [0, 90, 180, 270] },
    printed_pages: { type: 'string', description: 'printed page numbers found, e.g. "8-9" or ""' },
    content_types: { type: 'array', items: { type: 'string' } },
    exercise_count: { type: 'integer' },
    illegible_count: { type: 'integer' },
    section_guess: { type: 'string' },
  },
  required: ['page', 'orientation', 'content_types', 'exercise_count', 'illegible_count'],
}

const QA_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    page: { type: 'integer' },
    ok: { type: 'boolean' },
    missing_count: { type: 'integer' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['page', 'ok', 'missing_count'],
}

const CONTENT_TYPES = 'cover, toc, intro, instructions, reading-text, exercise, listening-sheet, writing-prompt, speaking-prompt, vocabulary, answer-key, lesson, grammar-box, dialogue, audio-script, wordlist, chapter-opener, review, picture-story, song'

const txPrompt = pg => `ZERO-DATA-LOSS transcription of ONE page from German ${LEVEL} learning material "${SRC}" (this may be an exam paper, a coursebook/Kursbuch, a test booklet, or a workbook — transcribe whatever is on the page).
IMAGE: ${img(pg)}  (300-DPI render of a single page; it may be a SCANNED page — expect skew, speckle, and occasionally rotated pages.)

STEP 1 — ORIENTATION. Read the image. If the printed content is NOT upright (text not horizontal, left-to-right), fix it:
   python "${ROTATE}" "${img(pg)}" <deg>   (deg = clockwise 90/180/270). Then Read again to confirm. Record total clockwise rotation as orientation (0 if none — expected for most pages).

STEP 2 — TRANSCRIBE EVERYTHING, VERBATIM (no paraphrase, translation, or summary; keep German spelling, umlauts ä/ö/ü and ß, and punctuation EXACTLY):
 - Section/part banners (e.g. "Hören", "Lesen", "Schreiben", "Sprechen", "Teil 1", "Kandidatenblätter", "Prüferblätter").
 - Instructions/"Anweisungen" in full.
 - Reading texts (emails, notices, ads, articles) — every word.
 - EVERY task/item: its printed number and letter options. Multiple-choice → keep ALL options with their markers (a/b/c or A/B/C or 1/2/3); if one is marked/crossed, note "(marked: b)".
 - Matching tasks → preserve both columns (e.g. "Anzeige a … Situation 1"); render as a Markdown table when tabular.
 - Listening answer sheets → transcribe the grid; where an item refers to an audio segment, add "🔊 [track ${pg}]" is NOT assumed — only note audio references the page itself prints.
 - True/False (Richtig/Falsch), fill-in blanks → "___" keeping surrounding words.
 - Vocabulary lists → Markdown tables, every entry/cell.
 - Writing ("Schreiben") and speaking ("Sprechen") prompts → verbatim.
 - Answer keys / "Lösungen" → every answer verbatim.
 - COURSEBOOK/TEXTBOOK pages: transcribe lesson text, grammar boxes and tables, dialogues (keep speaker labels), captions under pictures, song/chant lyrics, and every activity instruction + item. For audio scripts ("Hörtext"/"Transkription") transcribe the spoken text verbatim with speaker labels.
 - Page numbers, footnotes, captions.
 - Genuinely illegible text → "<!-- illegible: best-guess \\"...\\" -->". NEVER silently omit.
 - If small text is unclear, zoom: python "${ZOOM}" "${img(pg)}" <x0> <y0> <x1> <y1> "${ROOT}/_tools/_z_${pad(pg)}.png" (fractional coords), then Read the zoom file.

STEP 3 — LEVEL is FIXED: this whole document is ${LEVEL}. Do NOT infer or tag per-exercise levels.

STEP 4 — WRITE the file ${mdp(pg)} with EXACTLY this frontmatter then the body:
---
source: ${SRC}
collection: ${COLLECTION}
page: ${pg}
orientation: <0|90|180|270>
content_type: [<from: ${CONTENT_TYPES}>]
level: ${LEVEL}
section: <best-guess: hoeren|lesen|schreiben|sprechen|vocabulary|answer-key|"" >
status: transcribed
qa: pending
---
<the full verbatim transcription>

Return the structured summary.`

const qaPrompt = pg => `ADVERSARIAL ZERO-DATA-LOSS QA of one German ${LEVEL} learning-material page.
IMAGE (upright): ${img(pg)}
TRANSCRIPTION FILE: ${mdp(pg)}
Read BOTH carefully. Find ANYTHING on the image missing/altered/wrong in the transcription: missing tasks, missing options (a/b/c), missing matching pairs, missing table cells, missing answer-key entries, missing instructions/reading-text sentences, mis-transcribed words or umlauts/ß, dropped blanks, dropped page numbers. Be adversarial — assume an omission exists until every block is checked. Zoom with python "${ZOOM}" if needed.
Do NOT flag minor Markdown-table spacing.
Then WRITE your verdict as JSON to ${side(pg)} in EXACTLY this shape:
{"page": ${pg}, "ok": <true|false>, "missing_count": <int>, "issues": ["<precise description>", ...]}
ok=true ONLY if nothing is missing/wrong. Do NOT edit the transcription file. Return the same verdict.`

const repairPrompt = pg => `REPAIR a German ${LEVEL} learning-material page transcription that FAILED QA.
IMAGE (upright): ${img(pg)}
TRANSCRIPTION FILE: ${mdp(pg)}
QA VERDICT (problems found): ${side(pg)}
Read the QA verdict JSON, the image, and the transcription. FIX every issue by editing ${mdp(pg)} with the Edit tool so it becomes a complete, faithful, verbatim transcription (keep German spelling/umlauts/ß exactly; keep level ${LEVEL}). Zoom with python "${ZOOM}" if needed. Do NOT remove correct content.
Then re-verify the WHOLE page against the image once more and OVERWRITE ${side(pg)} with the updated verdict JSON {"page": ${pg}, "ok": <true|false>, "missing_count": <int>, "issues": [...]}.
Return the final verdict.`

phase('Transcribe')
const results = await pipeline(
  PAGES,
  pg => agent(txPrompt(pg), { label: `tx:${COLLECTION} p${pg}`, phase: 'Transcribe', schema: TX_SCHEMA, effort: 'high' }),
  (tx, pg) => agent(qaPrompt(pg), { label: `qa:${COLLECTION} p${pg}`, phase: 'QA', schema: QA_SCHEMA, effort: 'high' })
    .then(qa => ({ pg, tx, qa })),
  (r) => {
    if (r.qa && r.qa.ok) return { ...r, repaired: false, finalOk: true }
    return agent(repairPrompt(r.pg), { label: `fix:${COLLECTION} p${r.pg}`, phase: 'Repair', schema: QA_SCHEMA, effort: 'high' })
      .then(fix => ({ ...r, repaired: true, finalOk: !!(fix && fix.ok), fix }))
  }
)

const done = results.filter(Boolean)
const passed = done.filter(r => r.finalOk)
const failed = done.filter(r => !r.finalOk)
const repaired = done.filter(r => r.repaired)
const rotated = done.filter(r => r.tx && r.tx.orientation)
log(`batch ${COLLECTION}: ${done.length} pages | ${passed.length} pass | ${failed.length} still-fail | ${repaired.length} repaired | ${rotated.length} rotated`)
return {
  collection: COLLECTION,
  processed: done.length,
  pass: passed.length,
  still_failing: failed.map(r => r.pg),
  repaired_pages: repaired.map(r => r.pg),
  rotated_pages: rotated.map(r => ({ page: r.pg, deg: r.tx.orientation })),
}
