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
  const NETLIFY_URL = "https://lingotran-engine.netlify.app";
  const REPO_URL = "https://github.com/Kimosabey/lingotran-engine";

  /* ---- Engine ---------------------------------------------------------- */
  const engine = {
    name: "Lingotran Engine",
    kicker: "Extraction Knowledge Base",
    purpose: "A scalable workflow for extracting structured linguistic data from scanned " +
      "language-learning PDFs and authorized websites — turning textbook and exam content " +
      "into clean, faithful, structured material for study tools.",
    goal: "Zero data loss",
    method: "Claude-vision transcription of 300-DPI page scans (no text layer), verified by an " +
      "adversarial QA pass and repaired until faithful — plus an adapter-driven extractor " +
      "for authorized websites.",
    languages: [
      { name: "French", code: "FR", slug: "french", status: "active", href: "french/", books: 2, spreads: 287 },
      {
        name: "German", code: "DE", slug: "german", status: "active",
        href: REPO_URL + "/tree/main/german/extracted",
        meta: "10 books · 636 pages · 113 web pages"
      },
      { name: "Japanese", code: "JA", slug: "japanese", status: "planned" },
      { name: "Portuguese", code: "PT", slug: "portuguese", status: "planned" },
      { name: "Romanian", code: "RO", slug: "romanian", status: "planned" },
      { name: "Russian", code: "RU", slug: "russian", status: "planned" },
      { name: "Spanish", code: "ES", slug: "spanish", status: "planned" }
    ]
  };

  /* ---- Global metrics (hub) — from manifest.tsv / MANIFEST.md ---------- */
  const metrics = [
    { num: "12",  lab: "Document sets",   sub: "2 French workbooks · 10 German book/exam sets" },
    { num: "923", lab: "Pages",           sub: "287 FR spreads · 636 DE pages" },
    { num: "738", lab: "Transcribed",     sub: "80% of all pages", cls: "" },
    { num: "696", lab: "QA-verified",     sub: "75% zero-loss verified", cls: "green" }
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

  /* ---- German corpus ---------------------------------------------------- */
  const german = {
    slug: "german", name: "German", code: "DE", level: "A1 (CEFR)",
    aggregate: { collections: 10, pages: 636, verified: 636, questions: 2830, words: 3751 },
    channels: [
      {
        key: "pdf", name: "PDF · Goethe-Zertifikat A1",
        blurb: "Seven official, free Goethe-Institut practice PDFs (Start Deutsch 1 + Fit in Deutsch 1), " +
          "vision-transcribed and adversarially QA-verified.",
        pages: 302, verified: 302, note: "100% verified · 0 QA failures · 1 page auto-repaired"
      },
      {
        key: "pdf", name: "PDF · A1 Textbooks (scanned)",
        blurb: "Three scanned A1 coursebooks — Netzwerk neu A1 Kursbuch + Test Booklet (Klett) and " +
          "German for Young Learners A1 (Goyal) — vision-transcribed from 300-DPI scans and QA-verified.",
        pages: 334, verified: 334, note: "100% verified · zero data loss across scans"
      },
      {
        key: "web", name: "Web · deutsch-pruefung.de",
        blurb: "Public, robots-allowed pages extracted by the adapter-driven web module — " +
          "32 study guides plus ~80 exam/section info pages.",
        pages: 113, verified: 113, note: "public pages only · login-gated content excluded"
      }
    ],
    exports: [
      ["Unified document", "<collection>.md", "Overview + page index + full verbatim transcription"],
      ["Page sheet", "<collection>-catalog.csv", "One row per page · section, activity, topic, summary"],
      ["Question sheet", "<collection>-questions.csv", "One row per item · options + correct answer"],
      ["Word sheet", "<collection>-vocabulary.csv", "One row per word · article, plural, example"]
    ],
    collections: {
      "goethe-a1-sd1-exam-training-1": { title: "Start Deutsch 1 — Exam training 1", variant: "start-deutsch-1", pages: 47, verified: 47, questions: 61, words: 0 },
      "goethe-a1-sd1-exam-training-2": { title: "Start Deutsch 1 — Exam training 2", variant: "start-deutsch-1", pages: 47, verified: 47, questions: 41, words: 0 },
      "goethe-a1-sd1-exam-training-3": { title: "Start Deutsch 1 — Exam training 3", variant: "start-deutsch-1", pages: 47, verified: 47, questions: 66, words: 0 },
      "goethe-a1-sd1-vocabulary-list": { title: "Start Deutsch 1 — Wortliste", variant: "start-deutsch-1", pages: 29, verified: 29, questions: 0, words: 808 },
      "goethe-a1-fit1-exam-training-1": { title: "Fit in Deutsch 1 — Exam training 1", variant: "fit-in-deutsch-1", pages: 52, verified: 52, questions: 29, words: 0 },
      "goethe-a1-fit1-exam-training-2": { title: "Fit in Deutsch 1 — Exam training 2", variant: "fit-in-deutsch-1", pages: 52, verified: 52, questions: 50, words: 0 },
      "goethe-a1-fit1-vocabulary-list": { title: "Fit in Deutsch 1 — Wortliste", variant: "fit-in-deutsch-1", pages: 28, verified: 28, questions: 0, words: 756 },
      "netzwerk-a1-kursbuch": { title: "Netzwerk neu A1 — Kursbuch", variant: "netzwerk-neu-a1", pages: 174, verified: 174, questions: 1119, words: 1971 },
      "netzwerk-a1-test-booklet": { title: "Netzwerk neu A1 — Test Booklet", variant: "netzwerk-neu-a1", pages: 56, verified: 56, questions: 415, words: 98 },
      "goyal-a1-young-learners": { title: "German for Young Learners — A1", variant: "young-learners", pages: 104, verified: 104, questions: 1049, words: 118 }
    },
    itemTypes: [
      { k: "Fill-in", v: 889 }, { k: "Matching", v: 478 }, { k: "Short answer", v: 464 },
      { k: "Multiple choice", v: 297 }, { k: "Speaking task", v: 282 }, { k: "True/False", v: 162 },
      { k: "Writing task", v: 97 }, { k: "Open", v: 89 }, { k: "Ordering", v: 58 }, { k: "Open-ended", v: 14 }
    ]
  };

  /* ---- Orchestration & models (the "Engine" page) --------------------- */
  const orchestration = {
    intro: "The engine only spends a model where a human would need eyes (reading a scan) " +
      "or judgement (finding an omission, classifying). Everything else is plain Python — " +
      "free and instant. Work flows one direction; every step writes an artifact the next " +
      "step reads, so any step is re-runnable and the whole job is resumable.",
    // The left-to-right pipeline (animated). kind drives the colour + label.
    flow: [
      { icon: "file", title: "Source PDF", sub: "scanned or digital", kind: "free" },
      { icon: "image", title: "Rasterise", sub: "pdf_to_images.py · 300 DPI", kind: "free" },
      { icon: "eye", title: "Transcribe", sub: "vision · verbatim Markdown", kind: "vision" },
      { icon: "search", title: "QA check", sub: "vision · adversarial re-read", kind: "vision" },
      { icon: "wrench", title: "Repair", sub: "vision · only if QA fails", kind: "vision" },
      { icon: "tag", title: "Enrich", sub: "text · classify + questions + words", kind: "text" },
      { icon: "grid", title: "Export", sub: "Python · CSVs + docs + dashboard", kind: "free" }
    ],
    // Who does what.
    roles: [
      { name: "Rasteriser", does: "Turns each PDF page into a 300-DPI image", model: "Python (PyMuPDF)", kind: "free" },
      { name: "Transcriber", does: "Looks at the page image and types every word, verbatim", model: "Vision — Opus 4.8", kind: "vision" },
      { name: "QA checker", does: "Reads the same image again as a sceptic, hunting for anything missed", model: "Vision — Opus 4.8", kind: "vision" },
      { name: "Repairer", does: "Fixes only the pages QA flagged, then re-verifies", model: "Vision — Opus 4.8", kind: "vision" },
      { name: "Classifier", does: "Tags each page's topic + activity from the typed text", model: "Text — Sonnet / Haiku", kind: "text" },
      { name: "Question extractor", does: "Pulls out each exercise item + its answer", model: "Text — Sonnet / Haiku", kind: "text" },
      { name: "Vocabulary extractor", does: "Pulls out word + article + plural + example", model: "Text — Sonnet / Haiku", kind: "text" },
      { name: "Packager", does: "Builds the CSVs, unified docs, combined sheets, dashboard", model: "Python", kind: "free" }
    ],
    // Model tiers.
    tiers: [
      { key: "vision", icon: "eye", title: "Vision work", model: "Opus 4.8", why: "Scans are messy — skew, faint pencil, rotated pages. Accuracy here matters most because everything is built on top of it.", jobs: ["Transcribe", "QA", "Repair"] },
      { key: "text", icon: "type", title: "Text work", model: "Sonnet / Haiku", why: "Only reads the already-typed Markdown — an easy job, so a cheap fast model does it well.", jobs: ["Classify", "Questions", "Vocabulary"] },
      { key: "free", icon: "cpu", title: "No model", model: "Python", why: "Just moving data around — deterministic, free, instant, re-runnable any time.", jobs: ["Rasterise", "Manifest", "Sheets", "Dashboard"] }
    ],
    // The layers (condensed from EXTRACTION-WORKFLOW).
    layers: [
      { n: 0, name: "Source", tool: "manual", kind: "free", out: "PDF on disk (gitignored)" },
      { n: 1, name: "Rasterise", tool: "pdf_to_images.py", kind: "free", out: "page-NNN.png (300 DPI)" },
      { n: 2, name: "Seed state", tool: "manifest_media.py init", kind: "free", out: "manifest-media.tsv (resume anchor)" },
      { n: 3, name: "Transcribe", tool: "vision agent", kind: "vision", out: "page-NNN.md (verbatim)" },
      { n: 4, name: "QA", tool: "vision agent", kind: "vision", out: "_qa/page-NNN.json (verdict)" },
      { n: 5, name: "Repair", tool: "vision agent", kind: "vision", out: "corrected page + verdict" },
      { n: 6, name: "Fold verdicts", tool: "manifest_media.py qa-apply", kind: "free", out: "frontmatter + manifest state" },
      { n: 7, name: "Unify", tool: "catalog.py", kind: "free", out: "<collection>.md + catalog.csv" },
      { n: 8, name: "Classify", tool: "text agent", kind: "text", out: "_class.json (topic · activity)" },
      { n: 9, name: "Questions", tool: "text agent", kind: "text", out: "_questions.json (item + answer)" },
      { n: 10, name: "Vocabulary", tool: "text agent", kind: "text", out: "_vocab/chunk-*.json" },
      { n: 11, name: "Export", tool: "questions.py · vocabulary.py · merge_all.py", kind: "free", out: "all CSVs + combined sheets" },
      { n: 12, name: "Dashboard", tool: "manifest_media.py dashboard", kind: "free", out: "MANIFEST-MEDIA.md" }
    ],
    // Real end-to-end use cases — the flow above applied to actual pages.
    usecases: [
      {
        title: "A scanned exercise page",
        input: "Netzwerk Kursbuch, page 66 — a printed WhatsApp-style chat exercise. No digital text, just ink on paper.",
        steps: [
          { icon: "image", label: "Rasterise" }, { icon: "eye", label: "Transcribe" },
          { icon: "search", label: "QA re-read" }, { icon: "tag", label: "Classify" },
          { icon: "type", label: "Extract item" }, { icon: "grid", label: "Export" }
        ],
        output: "netzwerk-a1-kursbuch-questions.csv → item_type: reading-comprehension · topic: communication · source_page: 066"
      },
      {
        title: "Cross-referencing an answer key",
        input: "Netzwerk Test Booklet — 38 exercises on pages 6-48, with the Lösungen (answer key) printed separately on pages 49-53.",
        steps: [
          { icon: "eye", label: "Transcribe both" }, { icon: "type", label: "Read exercise + key together" },
          { icon: "tag", label: "Match item → answer" }, { icon: "grid", label: "Export" }
        ],
        output: "netzwerk-a1-test-booklet-questions.csv → 377 of 415 rows carry a filled correct_answer, matched from the key"
      },
      {
        title: "A dense alphabetical word list",
        input: "Netzwerk Kursbuch, pages 160-174 — the book's back-of-book Wortliste, ~780 entries per page, three columns.",
        steps: [
          { icon: "image", label: "Rasterise" }, { icon: "eye", label: "Transcribe" },
          { icon: "type", label: "Extract word + article + plural" }, { icon: "grid", label: "Export" }
        ],
        output: "netzwerk-a1-kursbuch-vocabulary.csv → 1,971 words, one row each (word · article · plural · example · topic)"
      },
      {
        title: "A digital-born PDF — the recommended path (not yet run on this corpus)",
        input: "A PDF exported straight from a word processor — the text is already selectable, not a scan. None of the 10 books here needed this path; it's the efficiency upgrade proposed for a future source.",
        steps: [
          { icon: "file", label: "Detect text layer" }, { icon: "type", label: "Extract text (Python)" },
          { icon: "tag", label: "Classify" }, { icon: "grid", label: "Export" }
        ],
        output: "Same page.md shape — but vision, transcribe and QA are skipped entirely. Zero usage-window spent on this page."
      }
    ],

    // Share of the usage window (subscription accounts — not $ per token).
    cost: [
      { k: "Transcription", v: 45, note: "read image + type — unavoidable for real scans" },
      { k: "QA (2nd image read)", v: 35, note: "the biggest 'is it worth it?' cost" },
      { k: "Wasted re-runs", v: 10, note: "agents killed mid-work by limits — avoidable" },
      { k: "Enrichment (text)", v: 8, note: "cheap, on a small model" },
      { k: "Repair", v: 2, note: "rare" },
      { k: "Python steps", v: 0, note: "free" }
    ],
    savers: [
      ["Detect a text layer first", "Digital PDFs already contain text — pull it out with Python for free and skip vision entirely. Huge saving."],
      ["Tier the QA", "Auto-pass trivial pages (covers/TOC); full image-QA only on real content. Roughly halves the biggest cost."],
      ["Right-size model + effort", "Opus for hard scans; Haiku + low effort for clean pages and wordlists."],
      ["One-pass enrichment", "One text read emits classify + questions + vocab together, not three reads."],
      ["Run heavy waves on a fresh window", "The #1 avoidable loss was feeding expensive agents into an almost-empty usage window."]
    ],
    // Effort ledger — honest counts + the real journey (multi-session, over ~3 days).
    effort: {
      summary: "This wasn't one clean run. It was built across many sessions over roughly three days, " +
        "surviving account switches, an API overload storm, and repeated usage-limit resets — with " +
        "zero data lost, because every page is written to disk atomically and progress is recomputed " +
        "from disk truth on every resume.",
      ledger: [
        { num: "636", lab: "Pages transcribed", sub: "word-for-word, every one" },
        { num: "636", lab: "Pages QA-verified", sub: "independent adversarial re-read, 0 gaps" },
        { num: "2,830", lab: "Questions extracted", sub: "with answers, where a key exists" },
        { num: "3,751", lab: "Vocabulary words", sub: "word · article · plural · example" }
      ],
      timeline: [
        { phase: "Acquire + rasterise", eta: "minutes · free", detail: "10 book-sets downloaded; every page rendered to a 300-DPI image by Python." },
        { phase: "Transcribe + QA", eta: "the long pole · many sessions", detail: "Each page read by a vision model, typed verbatim, then re-read by an independent checker. ~5-6 pages per agent, ~7-30 min each. Spanned several usage windows." },
        { phase: "Recover + verify to 100%", eta: "iterative", detail: "Killed/failed pages recomputed from disk and re-run until the completeness gate showed 0 gaps across all 636 pages." },
        { phase: "Enrich", eta: "~1 session", detail: "25 text passes pulled out the question bank + word lists; a disk-truth check caught one missing chunk (goyal 37-54) and it was re-run." },
        { phase: "Export + package + deliver", eta: "minutes · free", detail: "Python built every CSV, unified doc, combined sheet, dashboard and the content-team START-HERE." }
      ],
      resilience: [
        "Survived multiple account switches mid-run",
        "Survived a 529 API-overload storm",
        "Survived session-limit + credit resets",
        "Zero pages lost — every resume recomputed from disk"
      ]
    }
  };

  return { NETLIFY_URL, REPO_URL, engine, orchestration, metrics, workflow, tools, conventions, french, german };
})();
