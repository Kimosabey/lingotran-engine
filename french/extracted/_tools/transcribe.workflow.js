export const meta = {
  name: 'transcribe-french-pages',
  description: 'Zero-loss vision transcription + adversarial QA + repair of scanned French A1/A2 pages',
  phases: [
    { title: 'Transcribe', detail: 'orientation self-correct + faithful Markdown + inferred level' },
    { title: 'QA', detail: 'independent omission check; write verdict sidecar' },
    { title: 'Repair', detail: 'fix QA-failed pages and re-verify' },
  ],
}

const ROOT = 'd:\\Harshan\\french-a1-a2\\extracted'
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { } }
A = A || {}
const BOOK = A.book            // e.g. 'conjugaison-a1-a2'
const SRC = A.src              // source PDF filename (for frontmatter)
let PAGES = A.pages            // array of page numbers (ints)
if (typeof PAGES === 'string') { try { PAGES = JSON.parse(PAGES) } catch (e) { } }
if (Array.isArray(PAGES)) PAGES = PAGES.map(Number)
log(`args: book=${BOOK} src=${SRC} pages=${Array.isArray(PAGES) ? PAGES.length + ' pages' : typeof PAGES}`)
if (!Array.isArray(PAGES)) throw new Error('PAGES not an array; got ' + JSON.stringify(A))
const pad = n => String(n).padStart(3, '0')
const img = pg => `${ROOT}\\${BOOK}\\images\\page-${pad(pg)}.png`
const mdp = pg => `${ROOT}\\${BOOK}\\pages\\page-${pad(pg)}.md`
const side = pg => `${ROOT}\\${BOOK}\\pages\\_qa\\page-${pad(pg)}.json`

const TX_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    page: { type: 'integer' },
    orientation: { type: 'integer', enum: [0, 90, 180, 270] },
    printed_pages: { type: 'string', description: 'printed page numbers found, e.g. "18-19"' },
    content_types: { type: 'array', items: { type: 'string' } },
    levels_present: { type: 'array', items: { type: 'string' } },
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

const txPrompt = pg => `ZERO-DATA-LOSS transcription of ONE scanned page from the French A1/A2 book "${SRC}".
IMAGE: ${img(pg)}  (300-DPI scan; usually a TWO-PAGE BOOK SPREAD = left page + right page side by side).

STEP 1 — ORIENTATION. Read the image. If the printed content is NOT upright (text not horizontal, left-to-right), fix it by running:
   python "${ROOT}\\_tools\\rotate.py" "${img(pg)}" <deg>
with <deg> = clockwise degrees needed (90, 180 or 270). Then Read the image again to confirm it is upright; repeat if needed. Record total clockwise rotation applied as orientation (0 if none).

STEP 2 — TRANSCRIBE EVERYTHING, VERBATIM (no paraphrase, no translation, no summary; keep French spelling/accents/punctuation EXACTLY):
 - Handle the LEFT book page first, then the RIGHT. Separate them with a heading "## Page <printed number>" (read the number in the page's bottom corner; if illegible use "## Page (left)" / "## Page (right)").
 - Unit/chapter banner titles (e.g. "02 • Le présent de l'indicatif des verbes en « -er »").
 - Grammar reminder / "rappel" boxes and worked-example boxes — transcribe in full.
 - EVERY exercise: its printed number, the full consigne (instruction), the "Exemple:" line(s), and EVERY item with its printed letter/number (a., b., 1., 2., …).
 - Conjugation tables / grids → GitHub Markdown tables, every cell preserved.
 - Fill-in blanks → "___" (keep any printed words around them).
 - Multiple-choice columns (e.g. "e / es / ent") → keep all options; if one is circled/marked, note "(circled: ent)".
 - Audio-task badges → "🔊 [track NN]".
 - Answer keys / "Corrigés" → every answer verbatim.
 - Captions, footnotes, arrows, and printed page numbers.
 - Genuinely illegible text → "<!-- illegible: best-guess \\"...\\" -->". NEVER silently omit anything.
 - If you cannot read small text confidently, zoom in: python "${ROOT}\\_tools\\zoom.py" "${img(pg)}" <x0> <y0> <x1> <y1> "${ROOT}\\_tools\\_z_${pad(pg)}.png" (fractional coords) then Read the zoom file.

STEP 3 — INFER LEVEL. For EACH exercise, infer CEFR level (A1 or A2) by grammar/vocab difficulty and mark it inline at the exercise start as "**[A1 (inferred)]**" or "**[A2 (inferred)]**". This is the ONLY non-verbatim addition; it MUST say "(inferred)".

STEP 4 — WRITE the file ${mdp(pg)} with EXACTLY this frontmatter then the body:
---
source: ${SRC}
page: ${pg}
orientation: <0|90|180|270>
content_type: [<from: cover, toc, intro, explanation, conjugation-table, exercise, bilan, answer-key>]
level: <A1 | A2 | A1+A2> (inferred)
section: <best-guess chapter/unit slug or empty>
status: transcribed
qa: pending
---
<the full verbatim transcription>

Return the structured summary.`

const qaPrompt = pg => `ADVERSARIAL ZERO-DATA-LOSS QA of one scanned French page.
IMAGE (now upright): ${img(pg)}
TRANSCRIPTION FILE: ${mdp(pg)}
Read BOTH carefully. Find ANYTHING on the image that is missing, altered, or wrong in the transcription: missing exercises, missing items (a./b./…), missing table cells, missing answer-key entries, missing instructions/examples, mis-transcribed words or accents, dropped blanks, dropped "🔊 [track]" badges, dropped page numbers. Be adversarial — assume an omission exists until you have checked every block. Zoom with python "${ROOT}\\_tools\\zoom.py" if needed.
Do NOT flag the inline "[A1/A2 (inferred)]" level tags — those are intentional, nor minor Markdown-table spacing.
Then WRITE your verdict as JSON to ${side(pg)} in EXACTLY this shape:
{"page": ${pg}, "ok": <true|false>, "missing_count": <int>, "issues": ["<precise description>", ...]}
ok=true ONLY if nothing is missing/wrong. Do NOT edit the transcription file. Return the same verdict.`

const repairPrompt = pg => `REPAIR a scanned-page transcription that FAILED QA.
IMAGE (upright): ${img(pg)}
TRANSCRIPTION FILE: ${mdp(pg)}
QA VERDICT (problems found): ${side(pg)}
Read the QA verdict JSON, the image, and the transcription. FIX every issue by editing ${mdp(pg)} with the Edit tool so it becomes a complete, faithful, verbatim transcription (keep French spelling/accents exactly; keep the inline "[A1/A2 (inferred)]" tags). Zoom with python "${ROOT}\\_tools\\zoom.py" if needed to read small text. Do NOT remove correct content.
Then re-verify the WHOLE page against the image one more time and OVERWRITE ${side(pg)} with the updated verdict JSON {"page": ${pg}, "ok": <true|false>, "missing_count": <int>, "issues": [...]}.
Return the final verdict.`

phase('Transcribe')
const results = await pipeline(
  PAGES,
  pg => agent(txPrompt(pg), { label: `tx:${BOOK} p${pg}`, phase: 'Transcribe', schema: TX_SCHEMA, effort: 'high' }),
  (tx, pg) => agent(qaPrompt(pg), { label: `qa:${BOOK} p${pg}`, phase: 'QA', schema: QA_SCHEMA, effort: 'high' })
    .then(qa => ({ pg, tx, qa })),
  (r) => {
    const pg = r.pg
    if (r.qa && r.qa.ok) return { ...r, repaired: false, finalOk: true }
    return agent(repairPrompt(pg), { label: `fix:${BOOK} p${pg}`, phase: 'Repair', schema: QA_SCHEMA, effort: 'high' })
      .then(fix => ({ ...r, repaired: true, finalOk: !!(fix && fix.ok), fix }))
  }
)

const done = results.filter(Boolean)
const passed = done.filter(r => r.finalOk)
const failed = done.filter(r => !r.finalOk)
const repaired = done.filter(r => r.repaired)
const rotated = done.filter(r => r.tx && r.tx.orientation)
log(`batch ${BOOK}: ${done.length} pages | ${passed.length} pass | ${failed.length} still-fail | ${repaired.length} repaired | ${rotated.length} rotated`)
return {
  book: BOOK,
  processed: done.length,
  pass: passed.length,
  still_failing: failed.map(r => r.pg),
  repaired_pages: repaired.map(r => r.pg),
  rotated_pages: rotated.map(r => ({ page: r.pg, deg: r.tx.orientation })),
}
