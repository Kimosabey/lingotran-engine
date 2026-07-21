/**
 * High-level extraction-pipeline port.
 *
 * The orchestrator (see `extraction.pipeline.ts`) implements this. Callers
 * (a CLI, a scheduler, a future CMS-publish job) depend only on this port.
 */
import type { CrawlRequest, CrawlOutcome } from '../models/crawl-context.model.js';

export interface ExtractionPipelinePort {
  /** Extract a single page. */
  run(request: CrawlRequest): Promise<CrawlOutcome>;
  /** Extract many pages (concurrency governed by the RateLimiter). */
  runMany(requests: CrawlRequest[]): Promise<CrawlOutcome[]>;
}
