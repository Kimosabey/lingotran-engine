/**
 * Runtime schema for the completeness / QA report.
 * Mirrors `models/completeness-report.model.ts`.
 */
import { z } from 'zod';

export const nodeCountsSchema = z.object({
  headings: z.number().int().nonnegative(),
  paragraphs: z.number().int().nonnegative(),
  lists: z.number().int().nonnegative(),
  tables: z.number().int().nonnegative(),
  images: z.number().int().nonnegative(),
  figures: z.number().int().nonnegative(),
  media: z.number().int().nonnegative(),
  links: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
});

export const completenessReportSchema = z.object({
  counts: nodeCountsSchema,
  expected: nodeCountsSchema.partial().optional(),
  missingSections: z.array(z.string()),
  duplicatesRemoved: z.number().int().nonnegative(),
  retries: z.number().int().nonnegative(),
  incomplete: z.boolean(),
  warnings: z.array(z.string()),
});
