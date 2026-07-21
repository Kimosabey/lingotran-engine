/**
 * The top-level extraction artifact: one fully-extracted page.
 *
 * `PageDocument` is what the emitter serializes to (a) structured JSON and
 * (b) Lingotran Markdown + frontmatter. It carries the ordered node tree,
 * flattened asset collections (for the completeness report and downstream
 * study tools), and the quality verdict.
 */
import type { PageMetadata } from './metadata.model.js';
import type {
  ContentNode,
  ImageNode,
  LinkNode,
  MediaNode,
} from './content-node.model.js';
import type { CompletenessReport } from './completeness-report.model.js';
import type { ProcessingStatus, QaStatus } from './enums.js';

/**
 * Flattened, de-duplicated asset views collected alongside the node tree.
 * These are convenience projections — the node tree remains the source of
 * truth for ordering and hierarchy.
 */
export interface PageAssets {
  readonly images: ImageNode[];
  readonly media: MediaNode[];
  /** All hyperlinks. Downloads are the subset with `kind === 'download'`. */
  readonly links: LinkNode[];
}

/** Provenance stamped by the pipeline for reproducibility/debugging. */
export interface Provenance {
  readonly adapterId: string;
  readonly extractorVersion: string;
  /** Which pipeline stages ran (for partial/resumed runs). */
  readonly stages: string[];
}

export interface PageDocument {
  readonly metadata: PageMetadata;
  /** Ordered tree of content blocks, preserving document hierarchy. */
  readonly nodes: ContentNode[];
  readonly assets: PageAssets;
  readonly completeness: CompletenessReport;
  readonly provenance: Provenance;

  readonly status: ProcessingStatus;
  readonly qa: QaStatus;
}
