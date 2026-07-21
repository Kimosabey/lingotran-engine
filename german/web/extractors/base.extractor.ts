/**
 * Abstract bases for the extraction layer.
 *
 * `AbstractContentExtractor` holds the shared DOM-walking skeleton (delegate
 * each element to the node-extractor registry, preserve order). The actual
 * traversal is implemented in phase 2; here it declares the shape and a
 * stable id-minting helper so extractors stay pure.
 */
import type { ParsedElement } from '../parsers/parser.interface.js';
import type { ContentNode } from '../models/content-node.model.js';
import type {
  ContentExtractor,
  ExtractionContext,
} from './content-extractor.interface.js';
import type { NodeExtractorRegistry } from './node-extractor.registry.js';

export abstract class AbstractContentExtractor implements ContentExtractor {
  protected counter = 0;

  constructor(protected readonly nodes: NodeExtractorRegistry) {}

  abstract extract(root: ParsedElement, ctx: ExtractionContext): ContentNode[];

  /** Mint a stable, monotonic node id. */
  protected assignId(): string {
    this.counter += 1;
    return `n${this.counter}`;
  }
}
