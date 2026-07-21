/**
 * Completeness / extraction-quality report.
 *
 * Produced by the validation stage. It is the web-source analogue of the
 * existing adversarial-QA verdict sidecar (`_qa/page-NNN.json`) and drives
 * the `qa` and `status` fields plus the extraction dashboards.
 */

/** Tally of extracted blocks, one field per node family the brief calls out. */
export interface NodeCounts {
  readonly headings: number;
  readonly paragraphs: number;
  readonly lists: number;
  readonly tables: number;
  readonly images: number;
  readonly figures: number;
  readonly media: number;
  readonly links: number;
  readonly downloads: number;
}

export interface CompletenessReport {
  /** What was actually extracted. */
  readonly counts: NodeCounts;
  /**
   * Optional expected counts (e.g. from a prior run, a sitemap hint, or an
   * adapter heuristic) used to detect regressions/incomplete extraction.
   */
  readonly expected?: Partial<NodeCounts>;

  /** Named sections the adapter expected but the extractor did not find. */
  readonly missingSections: string[];

  /** Blocks removed by de-duplication. */
  readonly duplicatesRemoved: number;

  /** Transient-failure retries spent to obtain this result. */
  readonly retries: number;

  /**
   * True when extraction is judged partial (empty main content, counts far
   * below expected, render never settled, etc.). Gates `status: failed`.
   */
  readonly incomplete: boolean;

  /** Human-readable notes, mirroring the QA sidecar's `issues[]`. */
  readonly warnings: string[];
}
