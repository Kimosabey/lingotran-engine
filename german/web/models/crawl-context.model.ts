/**
 * Crawl request/context domain types.
 *
 * Pure data threaded through the pipeline. It deliberately holds NO adapter,
 * logger, or config reference — those are cross-cutting dependencies injected
 * at the pipeline layer (see `pipelines/`), preserving the inward dependency
 * direction (models depend on nothing).
 */

/** A single unit of crawl work. */
export interface CrawlRequest {
  readonly url: string;
  /** Crawl depth from the seed (0 = seed). */
  readonly depth: number;
  /** The page this URL was discovered on, if any. */
  readonly discoveredFrom?: string;
}

/** Per-request execution context (data only). */
export interface CrawlContext {
  readonly request: CrawlRequest;
  /** Correlation id for tracing all logs of one request. */
  readonly correlationId: string;
  /** ISO-8601 start time. */
  readonly startedAt: string;
  /** 1-based attempt counter (incremented on retry). */
  readonly attempt: number;
}

/** Outcome envelope for a completed (or failed) request. */
export interface CrawlOutcome {
  readonly url: string;
  readonly ok: boolean;
  /** Populated on success. */
  readonly document?: import('./page-document.model.js').PageDocument;
  /** Populated on failure. */
  readonly error?: { readonly code: string; readonly message: string };
  readonly attempts: number;
  readonly durationMs: number;
}
