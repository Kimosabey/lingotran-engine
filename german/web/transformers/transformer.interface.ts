/**
 * Content-transformation ports.
 *
 * `ContentTransformer` cleans the extracted node tree: Unicode normalisation
 * (preserving German umlauts / ß and any French accents), meaningful
 * whitespace preservation, and de-duplication of repeated blocks.
 * `DocumentAssembler` composes the final `PageDocument` from its parts.
 */
import type { ContentNode } from '../models/content-node.model.js';
import type { PageMetadata } from '../models/metadata.model.js';
import type { PageAssets, PageDocument, Provenance } from '../models/page-document.model.js';
import type { CompletenessReport } from '../models/completeness-report.model.js';

export interface TransformContext {
  readonly dedupe: boolean;
  readonly preserveWhitespace: boolean;
  /** Normalise text to Unicode NFC so accents/umlauts round-trip cleanly. */
  readonly normalizeUnicode: boolean;
}

export interface TransformResult {
  readonly nodes: ContentNode[];
  readonly duplicatesRemoved: number;
}

export interface ContentTransformer {
  transform(nodes: ContentNode[], ctx: TransformContext): TransformResult;
}

export interface AssembleInput {
  readonly metadata: PageMetadata;
  readonly nodes: ContentNode[];
  readonly assets: PageAssets;
  readonly completeness: CompletenessReport;
  readonly provenance: Provenance;
}

export interface DocumentAssembler {
  assemble(input: AssembleInput): PageDocument;
}
