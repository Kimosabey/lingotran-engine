/**
 * Domain enumerations for the web-extraction module.
 *
 * Each enum is expressed as a frozen `as const` tuple plus a derived
 * string-literal union type. This keeps the values usable at runtime
 * (iteration, `zod.enum(...)`) while staying tree-shakeable and free of
 * TypeScript `enum` runtime overhead.
 *
 * These are pure domain constants — no framework or website-specific values.
 */

/** Structural type of a single extracted content block. */
export const NODE_TYPES = [
  'section', // container grouping child nodes (preserves hierarchy)
  'heading',
  'paragraph',
  'list',
  'table',
  'image',
  'figure',
  'media',
  'link',
  'quote',
  'code',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/**
 * Editorial classification of a page. Superset of the existing Lingotran
 * `content_type` enum, extended with web-native categories. Kept generic —
 * a page may carry several.
 */
export const CONTENT_TYPES = [
  // web-native
  'exam-overview',
  'exam-section',
  'guide',
  'blog-article',
  'faq',
  'mock-test-info',
  'landing',
  // carried over from the PDF corpus for cross-source consistency
  'cover',
  'toc',
  'intro',
  'explanation',
  'answer-key',
  'unknown',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** German exam families this corpus targets. Generic — not site-bound. */
export const EXAM_TYPES = [
  'goethe',
  'telc',
  'dtz',
  'testdaf',
  'einbuergerung',
  'unknown',
] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/** CEFR proficiency levels. */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** The four language-skill sections common to German exams. */
export const SKILL_SECTIONS = ['lesen', 'hoeren', 'schreiben', 'sprechen', 'unknown'] as const;
export type SkillSection = (typeof SKILL_SECTIONS)[number];

/** Lifecycle state of a single page in the corpus (mirrors manifest.tsv). */
export const PROCESSING_STATUS = [
  'pending', // discovered, not yet fetched
  'extracted', // structured content produced
  'transformed', // serialized to corpus artifacts
  'verified', // passed completeness/QA
  'failed', // unrecoverable or QA-failed
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUS)[number];

/** QA verdict, aligned with the existing `qa` frontmatter field. */
export const QA_STATUS = ['pending', 'pass', 'fail'] as const;
export type QaStatus = (typeof QA_STATUS)[number];

/** Classification of a hyperlink relative to the crawl origin. */
export const LINK_KINDS = ['internal', 'external', 'download', 'anchor', 'mailto'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** Kind of embedded media reference. */
export const MEDIA_KINDS = ['audio', 'video', 'embed', 'iframe'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Source-acquisition channel. `web` is the only one implemented here; the
 * others are reserved so that corpus artifacts record their provenance
 * uniformly as future sources (PDF, OCR, audio/video, API, CMS) are added.
 */
export const SOURCE_TYPES = [
  'web',
  'pdf',
  'ocr',
  'docx',
  'images',
  'audio',
  'video',
  'api',
  'manual',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * How a page must be loaded before parsing.
 *  - `static`  : plain HTTP fetch of server-rendered HTML (cheap, no browser).
 *  - `dynamic` : full browser render (Playwright) for client-rendered apps
 *                (e.g. Next.js / SPA sites).
 *  - `auto`    : try `static`; escalate to `dynamic` if content looks empty.
 * Declared per-adapter — never assumed globally.
 */
export const RENDER_MODES = ['static', 'dynamic', 'auto'] as const;
export type RenderMode = (typeof RENDER_MODES)[number];
