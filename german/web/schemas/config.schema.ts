/**
 * Runtime schema for module configuration.
 *
 * Covers every configuration concern the brief calls out: rate limiting,
 * retry policy, user agent, extraction rules, and output. Website-specific
 * behaviour is NOT configured here — it lives in adapters. What lives here
 * are engine-wide defaults an adapter may selectively override.
 */
import { z } from 'zod';
import { RENDER_MODES } from '../models/enums.js';

/** Politeness + transport. */
export const rateLimitConfigSchema = z.object({
  /** Minimum delay between requests to the same host (ms). */
  requestDelayMs: z.number().int().nonnegative().default(1500),
  /** Max simultaneous in-flight pages per host. */
  maxConcurrency: z.number().int().positive().default(2),
  /** Navigation/fetch timeout (ms). */
  timeoutMs: z.number().int().positive().default(30_000),
});

export const retryConfigSchema = z.object({
  maxRetries: z.number().int().nonnegative().default(3),
  /** Base backoff (ms); grows exponentially with attempt. */
  backoffMs: z.number().int().nonnegative().default(1000),
  backoffFactor: z.number().positive().default(2),
  /** HTTP statuses treated as transient (retryable). */
  retryableStatusCodes: z.array(z.number().int()).default([408, 429, 500, 502, 503, 504]),
});

export const userAgentConfigSchema = z.object({
  value: z.string().min(1),
  /** Whether robots.txt must be honoured. Never disable without authorization. */
  respectRobots: z.boolean().default(true),
});

/** Generic (NOT site-specific) extraction rules. */
export const extractionRulesConfigSchema = z.object({
  defaultRenderMode: z.enum(RENDER_MODES).default('auto'),
  /** Drop text blocks shorter than this many characters. */
  minTextLength: z.number().int().nonnegative().default(1),
  /** Collapse duplicate blocks. */
  dedupe: z.boolean().default(true),
  /** Keep meaningful whitespace (pre/code) rather than collapsing it. */
  preserveWhitespace: z.boolean().default(true),
  /**
   * Structural, site-agnostic selectors for chrome to ignore (nav/header/
   * footer/ads/social/related). Semantic HTML only — not tuned to any site.
   * Adapters may extend this list.
   */
  ignoreSelectors: z
    .array(z.string())
    .default([
      'nav',
      'header',
      'footer',
      'aside',
      '[role="banner"]',
      '[role="navigation"]',
      '[role="contentinfo"]',
      '[aria-hidden="true"]',
    ]),
});

export const outputConfigSchema = z.object({
  /** Corpus root, resolved relative to the module (stays under german/). */
  outputDir: z.string().default('../extracted'),
  emitJson: z.boolean().default(true),
  emitMarkdown: z.boolean().default(true),
  /** Update manifest.tsv after each page (enables incremental resume). */
  updateManifest: z.boolean().default(true),
});

export const loggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  pretty: z.boolean().default(true),
});

/** Optional future AI-enrichment stage (disabled by default). */
export const enrichmentConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: z.string().optional(),
});

export const moduleConfigSchema = z.object({
  rateLimit: rateLimitConfigSchema,
  retry: retryConfigSchema,
  userAgent: userAgentConfigSchema,
  extractionRules: extractionRulesConfigSchema,
  output: outputConfigSchema,
  logging: loggingConfigSchema,
  enrichment: enrichmentConfigSchema,
});

export type ModuleConfig = z.infer<typeof moduleConfigSchema>;
