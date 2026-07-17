/* ==========================================================================
   Lingotran Extraction Dashboard — single source of data
   Edit numbers here to refresh the whole site. Figures are sourced from
   french/extracted/manifest.tsv (authoritative) via MANIFEST.md, the two book
   READMEs, and _tools/transcribe.workflow.js (prompt text, verbatim).
   Regenerate the manifest numbers with:  python _tools/manifest.py dashboard
   ========================================================================== */
window.LT = (function () {

  /* ---- Deployment ------------------------------------------------------ */
  // ▸ Paste your live Netlify URL here (replaces the placeholder in the topbar badge).
  const NETLIFY_URL = "https://Lingotran-engine.netlify.app";
  const REPO_URL = "https://github.com/Kimosabey/Lingotran-engine";

  /* ---- Engine ---------------------------------------------------------- */
  const engine = {
    name: "Lingotran Engine",
    kicker: "Extraction Knowledge Base",
    purpose: "A scalable workflow for extracting structured linguistic data from scanned " +
      "language-learning PDFs — turning textbook content into clean, faithful, structured " +
      "material for study tools.",
    goal: "Zero data loss",
    method: "Claude-vision transcription of 300-DPI page scans (no text layer), verified by an " +
      "adversarial QA pass and repaired until faithful.",
    languages: [
      { name: "French", code: "FR", slug: "french", status: "active", href: "french/", books: 2, spreads: 287 },
      { name: "German", code: "DE", slug: "german", status: "planned" },
      { name: "Japanese", code: "JA", slug: "japanese", status: "planned" },
      { name: "Portuguese", code: "PT", slug: "portuguese", status: "planned" },
      { name: "Romanian", code: "RO", slug: "romanian", status: "planned" },
      { name: "Russian", code: "RU", slug: "russian", status: "planned" },
      { name: "Spanish", code: "ES", slug: "spanish", status: "planned" }
    ]
  };

  /* ---- Global metrics (hub) — from manifest.tsv / MANIFEST.md ---------- */
  const metrics = [
    { num: "2",   lab: "Document sets",   sub: "French A1/A2 workbooks" },
    { num: "287", lab: "Page spreads",    sub: "300-DPI two-page scans" },
    { num: "102", lab: "Transcribed",     sub: "36% of all spreads", cls: "" },
    { num: "60",  lab: "QA-verified",     sub: "21% zero-loss verified", cls: "green" }
  ];

  /* ---- The extraction workflow ---------------------------------------- */
  const workflow = {
    name: "transcribe-french-pages",
    desc: "Zero-loss vision transcription + adversarial QA + repair of scanned French A1/A2 pages.",
    runtime: "Runs as a 3-stage pipeline, one page at a time, each agent call at effort: high.",
    phases: [
      {
        n: 1, title: "Transcribe",
        detail: "Self-correct page orientation (auto-rotate sideways scans), then transcribe every " +
          "block verbatim to Markdown — exercises, tables, blanks, answer keys, page numbers — and " +
          "infer a CEFR level per exercise. Writes page-NNN.md with frontmatter.",
        meta: "effort: high · writes pages/page-NNN.md"
      },
      {
        n: 2, title: "QA",
        detail: "An independent, adversarial reader compares the image against the transcription and " +
          "assumes an omission exists until every block is checked — catching missing items, altered " +
          "words, dropped cells and badges. Writes a verdict sidecar.",
        meta: "effort: high · writes pages/_qa/page-NNN.json"
      },
      {
        n: 3, title: "Repair",
        detail: "Only runs when QA fails. Fixes every issue named in the verdict by editing the " +
          "transcription, then re-verifies the whole page and overwrites the verdict. Passing pages " +
          "skip this stage entirely.",
        meta: "effort: high · conditional on QA fail"
      }
    ],
    prompts: {
      transcribe:
`ZERO-DATA-LOSS transcription of ONE scanned page from the French A1/A2 book "\${SRC}".
IMAGE: \${img(pg)}  (300-DPI scan; usually a TWO-PAGE BOOK SPREAD = left page + right page side by side).

STEP 1 — ORIENTATION. Read the image. If the printed content is NOT upright (text not horizontal, left-to-right), fix it by running:
   python "\${ROOT}\\_tools\\rotate.py" "\${img(pg)}" <deg>
with <deg> = clockwise degrees needed (90, 180 or 270). Then Read the image again to confirm it is upright; repeat if needed. Record total clockwise rotation applied as orientation (0 if none).

STEP 2 — TRANSCRIBE EVERYTHING, VERBATIM (no paraphrase, no translation, no summary; keep French spelling/accents/punctuation EXACTLY):
 - Handle the LEFT book page first, then the RIGHT. Separate them with a heading "## Page <printed number>".
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
 - If you cannot read small text confidently, zoom in: python "\${ROOT}\\_tools\\zoom.py" "\${img(pg)}" <x0> <y0> <x1> <y1> (fractional coords) then Read the zoom file.

STEP 3 — INFER LEVEL. For EACH exercise, infer CEFR level (A1 or A2) by grammar/vocab difficulty and mark it inline at the exercise start as "**[A1 (inferred)]**" or "**[A2 (inferred)]**". This is the ONLY non-verbatim addition; it MUST say "(inferred)".

STEP 4 — WRITE the file with EXACTLY this frontmatter then the body:
---
source: \${SRC}
page: \${pg}
orientation: <0|90|180|270>
content_type: [<cover, toc, intro, explanation, conjugation-table, exercise, bilan, answer-key>]
level: <A1 | A2 | A1+A2> (inferred)
section: <best-guess chapter/unit slug or empty>
status: transcribed
qa: pending
---
<the full verbatim transcription>

Return the structured summary.`,
      qa:
`ADVERSARIAL ZERO-DATA-LOSS QA of one scanned French page.
IMAGE (now upright): \${img(pg)}
TRANSCRIPTION FILE: \${mdp(pg)}
Read BOTH carefully. Find ANYTHING on the image that is missing, altered, or wrong in the transcription: missing exercises, missing items (a./b./…), missing table cells, missing answer-key entries, missing instructions/examples, mis-transcribed words or accents, dropped blanks, dropped "🔊 [track]" badges, dropped page numbers. Be adversarial — assume an omission exists until you have checked every block. Zoom with python "\${ROOT}\\_tools\\zoom.py" if needed.
Do NOT flag the inline "[A1/A2 (inferred)]" level tags — those are intentional, nor minor Markdown-table spacing.
Then WRITE your verdict as JSON to the sidecar in EXACTLY this shape:
{"page": \${pg}, "ok": <true|false>, "missing_count": <int>, "issues": ["<precise description>", ...]}
ok=true ONLY if nothing is missing/wrong. Do NOT edit the transcription file. Return the same verdict.`,
      repair:
`REPAIR a scanned-page transcription that FAILED QA.
IMAGE (upright): \${img(pg)}
TRANSCRIPTION FILE: \${mdp(pg)}
QA VERDICT (problems found): \${side(pg)}
Read the QA verdict JSON, the image, and the transcription. FIX every issue by editing the file with the Edit tool so it becomes a complete, faithful, verbatim transcription (keep French spelling/accents exactly; keep the inline "[A1/A2 (inferred)]" tags). Zoom if needed to read small text. Do NOT remove correct content.
Then re-verify the WHOLE page against the image one more time and OVERWRITE the verdict JSON {"page": \${pg}, "ok": <true|false>, "missing_count": <int>, "issues": [...]}.
Return the final verdict.`
    }
  };

  /* ---- Developer tools ------------------------------------------------- */
  const tools = [
    {
      file: "_tools/transcribe.workflow.js", lang: "JavaScript",
      purpose: "Orchestrator for the 3-stage pipeline (Transcribe → QA → Repair). Reads a book slug, " +
        "source PDF name and a list of page numbers, then runs each page through all stages and reports " +
        "pass / still-failing / repaired / rotated counts.",
      usage: "args: { book, src, pages }  →  runs pipeline(pages, transcribe, qa, repair)"
    },
    {
      file: "_tools/manifest.py", lang: "Python",
      purpose: "State + dashboard tooling. manifest.tsv is the authoritative per-page state; MANIFEST.md " +
        "is a human dashboard regenerated from it.",
      commands: [
        ["init", "seed manifest.tsv with one row per page image (idempotent)"],
        ["dashboard", "regenerate MANIFEST.md progress tables from the TSV"],
        ["sync", "read each page's frontmatter back into the TSV, then rebuild the dashboard"],
        ["qa-apply", "fold _qa/*.json verdicts into the qa column (pass/fail) and append QA-issue notes"]
      ],
      usage: "python _tools/manifest.py <init|dashboard|sync|qa-apply>"
    },
    {
      file: "_tools/rotate.py", lang: "Python",
      purpose: "Rotate a scanned PNG clockwise by 90/180/270°, overwriting it and expanding the canvas so " +
        "nothing is cropped. Used by the Transcribe step's orientation self-correction.",
      usage: "python _tools/rotate.py <image.png> <90|180|270>"
    },
    {
      file: "_tools/zoom.py", lang: "Python",
      purpose: "Crop a fractional sub-region (coords 0..1) of a PNG and upscale 2× so small print is legible. " +
        "Used across all three stages to read fine text.",
      usage: "python _tools/zoom.py <image.png> <x0> <y0> <x1> <y1> <out.png>"
    }
  ];

  /* ---- Process & conventions ------------------------------------------ */
  const conventions = {
    tree:
`extracted/
  MANIFEST.md            progress dashboard (regenerated)
  manifest.tsv           AUTHORITATIVE per-page state (resume anchor)
  _tools/                manifest.py · rotate.py · zoom.py · transcribe.workflow.js
  <book>/
    README.md            book overview + table of contents (taxonomy)
    images/  page-NNN.png    300-DPI render, 1:1 with the PDF (visual source)
    pages/   page-NNN.md     faithful per-page transcription + frontmatter
    pages/_qa/page-NNN.json  adversarial QA verdict sidecar
    sections/A1/ · A2/       content reorganized by inferred CEFR level`,
    naming: "Pages are zero-padded to 3 digits (page-001 … page-181). Books use kebab-case slugs " +
      "(conjugaison-a1-a2, revision-2). Every image, transcription and verdict for a spread share the " +
      "same page-NNN stem.",
    frontmatter: [
      ["source", "source PDF filename"],
      ["page", "spread number (integer)"],
      ["orientation", "clockwise rotation applied: 0 / 90 / 180 / 270"],
      ["content_type", "list: cover · toc · intro · explanation · conjugation-table · exercise · bilan · answer-key"],
      ["level", "inferred CEFR: A1 / A2 / A1+A2 (inferred)"],
      ["section", "inferred chapter/unit slug"],
      ["status", "pending → transcribed → verified (or failed)"],
      ["qa", "pending · pass · fail"]
    ],
    status: [
      ["pending", "idle", "image exists, not yet transcribed"],
      ["transcribed", "idle", "faithful Markdown written, awaiting QA"],
      ["verified", "ok", "QA passed — zero data loss confirmed"],
      ["failed", "warn", "QA found issues — queued for Repair"]
    ]
  };

  /* ---- French corpus --------------------------------------------------- */
  const french = {
    slug: "french", name: "French", code: "FR", level: "A1 / A2 (CEFR)",
    aggregate: { books: 2, spreads: 287, transcribed: 102, verified: 60, qaPass: 51, qaFail: 16 },
    books: {

      "conjugaison-a1-a2": {
        slug: "conjugaison-a1-a2",
        title: "Pratique Conjugaison — 500 exercices",
        subtitle: "French verb conjugation practice · A1/A2",
        source: "PRATIQUE-CONJUGASION A1 A2.pdf",
        author: "Odile Grand-Clément", publisher: "CLE International",
        blurb: "A verb-conjugation workbook organized into 13 chapters by tense, each with exercises, a " +
          "brief “rappel” + worked examples, and Bilan review sections, plus end-of-book Corrigés.",
        spreads: 106, transcribed: 102, verified: 60, pending: 4,
        qaTotal: 67, qaPass: 51, qaFail: 16,
        status: "in progress",
        meters: [
          { name: "Transcribed", value: 102, of: 106, cls: "" },
          { name: "QA-verified", value: 60, of: 106, cls: "green" }
        ],
        charts: {
          contentType: [
            { k: "Exercise", v: 88 }, { k: "Explanation", v: 67 }, { k: "Bilan", v: 18 },
            { k: "Answer key", v: 15 }, { k: "Conjugation table", v: 6 },
            { k: "Cover", v: 2 }, { k: "Intro", v: 2 }, { k: "TOC", v: 2 }
          ],
          cefr: [ { k: "A1 + A2", v: 66 }, { k: "A2", v: 37 }, { k: "A1", v: 1 } ],
          orientation: [
            { k: "0° (upright)", v: 73 }, { k: "270° rotated", v: 29 },
            { k: "90° rotated", v: 2 }, { k: "unknown", v: 2 }
          ]
        },
        chapters: [
          [1, "Le présent de l'indicatif — être et avoir", 7],
          [2, "Le présent — verbes en « -er » (réguliers, aller, particularités)", 18],
          [3, "Le présent — certains verbes irréguliers (faire, dire, pouvoir…)", 31],
          [4, "Le présent — verbes en « -ir » (finir, ouvrir, partir, venir)", 45],
          [5, "Le présent — verbes en « -re » et « -oir »", 55],
          [6, "Le présent — verbes pronominaux", 67],
          [7, "L'imparfait — auxiliaires, -er et certains irréguliers", 76],
          [8, "L'imparfait de l'indicatif — -ir/-re/-oir, pronominaux", 90],
          [9, "Le passé composé avec avoir", 102],
          [10, "Le passé composé avec être", 125],
          [11, "Le passé composé en relation avec d'autres temps du passé", 146],
          [12, "Le futur de l'indicatif (simple / futur proche)", 153],
          [13, "L'impératif", 172]
        ]
      },

      "revision-2": {
        slug: "revision-2",
        title: "Pratique Révision 2",
        subtitle: "Vocabulaire + Grammaire/Conjugaison revision · A1/A2",
        source: "Pratique Révision 2.pdf",
        author: "", publisher: "",
        blurb: "A combined vocabulary + grammar/conjugation revision workbook in 28 units (Vocabulaire 1–12, " +
          "Grammaire/Conjugaison 13–28), with listening tasks (audio-track badges) and a Corrigés section near " +
          "the end. Extraction not yet started — images captured, transcription pending.",
        spreads: 181, transcribed: 0, verified: 0, pending: 181,
        qaTotal: 0, qaPass: 0, qaFail: 0,
        status: "not started",
        meters: [
          { name: "Transcribed", value: 0, of: 181, cls: "" },
          { name: "QA-verified", value: 0, of: 181, cls: "green" }
        ],
        charts: null,
        units: {
          part1: [
            [1, "Mise en route (alphabet, nombres, e-mail)", 5],
            [2, "Premières échanges (saluer, identité, pays & langues, professions)", 15],
            [3, "Les proches (famille, corps, caractère)", 30],
            [4, "Au quotidien (activités, objets, vêtements, couleurs)", 52],
            [5, "Pour tous les goûts (loisirs & sports, musique, culture)", 70],
            [6, "Chez moi (logement, pièces, mobilier)", 80],
            [7, "La ville et la campagne (lieux, transports)", 90],
            [8, "D'hier et d'aujourd'hui (saisons, mois, l'heure)", 102],
            [9, "C'est si bon! (repas, aliments, au restaurant)", 112],
            [10, "Les courses (achats, mesures, prix & paiement)", 124],
            [11, "En vacances (voyage, services, météo)", 133],
            [12, "Vie sociale (rendez-vous, directions, fêtes, internet)", 143]
          ],
          part2: [
            [13, "Le nom et l'article", 153], [14, "L'adjectif", 172], [15, "Les pronoms", null],
            [16, "Verbes courants: être, avoir, aller, faire", null],
            [17, "Le présent des verbes du 1ᵉʳ groupe", null],
            [18, "Les verbes en -ir, -re, -oir, -dre", null],
            [19, "Les verbes pronominaux", null],
            [20, "« C'est », « il y a » et les verbes impersonnels", null],
            [21, "La quantité", null], [22, "La négation", null], [23, "L'interrogation", null],
            [24, "La situation dans l'espace", null], [25, "L'expression du temps", null],
            [26, "L'impératif", null], [27, "Le futur proche", null], [28, "Le passé composé", null]
          ]
        }
      }
    }
  };

  return { NETLIFY_URL, REPO_URL, engine, metrics, workflow, tools, conventions, french };
})();
