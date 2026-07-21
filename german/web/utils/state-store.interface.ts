/**
 * Extraction-state store port (enables INCREMENTAL extraction).
 *
 * Backs the resume behaviour of the French corpus (`manifest.tsv` as the
 * authoritative per-page state / resume anchor). The pipeline records each
 * page's status and content hash so a re-run only re-processes changed or
 * unfinished pages.
 */
import type { ProcessingStatus, QaStatus } from '../models/enums.js';

export interface PageState {
  readonly slug: string;
  readonly sourceUrl: string;
  readonly status: ProcessingStatus;
  readonly qa: QaStatus;
  /** Content hash of the last successful extraction (change detection). */
  readonly contentHash?: string;
  readonly updatedAt?: string;
}

export interface StateStore {
  get(slug: string): Promise<PageState | undefined>;
  set(state: PageState): Promise<void>;
  list(): Promise<PageState[]>;
  /** True if `slug` needs (re-)processing given an optional freshness hash. */
  isStale(slug: string, currentHash?: string): Promise<boolean>;
}
