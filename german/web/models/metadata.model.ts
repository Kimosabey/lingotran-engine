/**
 * Page-level metadata domain model.
 *
 * This is the structured counterpart to the Lingotran Markdown frontmatter.
 * The serializer in `transformers/` maps these fields onto the corpus
 * frontmatter (`source_url`, `site`, `slug`, `exam`, `level`, `section`,
 * `content_type`, `status`, `qa`).
 */
import type {
  ContentType,
  ExamType,
  CefrLevel,
  SkillSection,
  SourceType,
} from './enums.js';

export interface PageMetadata {
  /** Fully-qualified URL the content was extracted from. */
  readonly sourceUrl: string;
  /** Canonical URL if the page declares one. */
  readonly canonicalUrl?: string;
  /** Host the page belongs to, e.g. "deutsch-pruefung.de". */
  readonly site: string;
  /** Stable slug derived from the URL path — replaces the PDF `page` number. */
  readonly slug: string;
  /** Acquisition channel; always "web" for this module. */
  readonly sourceType: SourceType;

  readonly title: string;
  readonly description?: string;
  /** BCP-47 language tag, e.g. "de" or "en". */
  readonly lang?: string;

  /** Inferred exam family (adapter-classified; never hardcoded in core). */
  readonly exam: ExamType;
  readonly level: CefrLevel;
  readonly section?: SkillSection;
  readonly contentType: ContentType[];

  /** Free-form open-graph / meta tags preserved verbatim. */
  readonly meta?: Readonly<Record<string, string>>;

  /** ISO-8601 timestamps (set by the emitter at write time). */
  readonly publishedAt?: string;
  readonly fetchedAt?: string;

  readonly wordCount?: number;
}
