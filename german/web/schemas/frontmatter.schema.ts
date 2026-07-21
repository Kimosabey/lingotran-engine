/**
 * Runtime schema for the Lingotran corpus frontmatter (web-source variant).
 *
 * This is the contract the Markdown serializer writes into each
 * `german/extracted/<collection>/pages/<slug>.md` file. It intentionally stays
 * compatible with the French PDF frontmatter (`source`, `content_type`,
 * `level`, `section`, `status`, `qa`) while swapping page-scan fields
 * (`page`, `orientation`) for web-source fields (`source_url`, `site`,
 * `slug`, `exam`).
 */
import { z } from 'zod';
import {
  CONTENT_TYPES,
  EXAM_TYPES,
  CEFR_LEVELS,
  SKILL_SECTIONS,
  PROCESSING_STATUS,
  QA_STATUS,
} from '../models/enums.js';

export const webFrontmatterSchema = z.object({
  /** Origin URL (web analogue of the PDF `source` filename). */
  source_url: z.string().url(),
  site: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  exam: z.enum(EXAM_TYPES),
  level: z.enum(CEFR_LEVELS),
  section: z.enum(SKILL_SECTIONS).optional(),
  content_type: z.array(z.enum(CONTENT_TYPES)).min(1),
  status: z.enum(PROCESSING_STATUS),
  qa: z.enum(QA_STATUS),
  /** ISO-8601 fetch time; supports incremental re-extraction. */
  fetched_at: z.string().optional(),
});

export type WebFrontmatter = z.infer<typeof webFrontmatterSchema>;
