/**
 * Content detection + extraction ports.
 *
 * `ContentDetector` locates the primary content region (Readability-style
 * heuristic, refined by the adapter's `contentRoot` selectors).
 * `ContentExtractor` walks that region into the ordered `ContentNode[]`
 * tree, stripping ignored chrome and preserving reading order + hierarchy.
 */
import type { ParsedDocument, ParsedElement } from '../parsers/parser.interface.js';
import type { ContentSelectors } from '../adapters/adapter.interface.js';
import type { ContentNode } from '../models/content-node.model.js';

/** Everything an extractor needs, injected — no globals, no site logic. */
export interface ExtractionContext {
  /** Adapter-provided content roots + extra ignore selectors. */
  readonly selectors: ContentSelectors;
  /** Global structural ignore selectors (nav/header/footer/…). */
  readonly ignoreSelectors: string[];
  readonly preserveWhitespace: boolean;
  readonly minTextLength: number;
  /** Page URL, for resolving relative asset/link hrefs. */
  readonly pageUrl: string;
}

export interface ContentDetector {
  /** Return the primary content root element, or null if none is found. */
  detect(doc: ParsedDocument, ctx: ExtractionContext): ParsedElement | null;
}

export interface ContentExtractor {
  /** Walk `root` into an ordered content-node tree. */
  extract(root: ParsedElement, ctx: ExtractionContext): ContentNode[];
}
