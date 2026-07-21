/**
 * Runtime schema for the top-level output artifact (`PageDocument`).
 * Mirrors `models/page-document.model.ts`. This is THE output schema the
 * emitter validates against before writing corpus artifacts.
 */
import { z } from 'zod';
import {
  CONTENT_TYPES,
  EXAM_TYPES,
  CEFR_LEVELS,
  SKILL_SECTIONS,
  SOURCE_TYPES,
  PROCESSING_STATUS,
  QA_STATUS,
} from '../models/enums.js';
import {
  contentNodeSchema,
  imageNodeSchema,
  linkNodeSchema,
  mediaNodeSchema,
} from './content-node.schema.js';
import { completenessReportSchema } from './completeness-report.schema.js';

export const pageMetadataSchema = z.object({
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  site: z.string().min(1),
  slug: z.string().min(1),
  sourceType: z.enum(SOURCE_TYPES),
  title: z.string(),
  description: z.string().optional(),
  lang: z.string().optional(),
  exam: z.enum(EXAM_TYPES),
  level: z.enum(CEFR_LEVELS),
  section: z.enum(SKILL_SECTIONS).optional(),
  contentType: z.array(z.enum(CONTENT_TYPES)),
  meta: z.record(z.string()).optional(),
  publishedAt: z.string().optional(),
  fetchedAt: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
});

export const pageAssetsSchema = z.object({
  images: z.array(imageNodeSchema),
  media: z.array(mediaNodeSchema),
  links: z.array(linkNodeSchema),
});

export const provenanceSchema = z.object({
  adapterId: z.string(),
  extractorVersion: z.string(),
  stages: z.array(z.string()),
});

export const pageDocumentSchema = z.object({
  metadata: pageMetadataSchema,
  nodes: z.array(contentNodeSchema),
  assets: pageAssetsSchema,
  completeness: completenessReportSchema,
  provenance: provenanceSchema,
  status: z.enum(PROCESSING_STATUS),
  qa: z.enum(QA_STATUS),
});
