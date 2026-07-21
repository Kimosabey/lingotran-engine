/**
 * Registry of per-node extractors.
 *
 * Holds the ordered set of `NodeExtractor`s and resolves the first one that
 * can handle a given element. Order matters: register more-specific
 * extractors (figure before image, table before list) ahead of generic ones.
 */
import type { ParsedElement } from '../parsers/parser.interface.js';
import type { NodeExtractor } from './node-extractor.interface.js';

export class NodeExtractorRegistry {
  private readonly extractors: NodeExtractor[] = [];

  register(extractor: NodeExtractor): this {
    this.extractors.push(extractor);
    return this;
  }

  /** First extractor that recognises `el`, or undefined. */
  resolve(el: ParsedElement): NodeExtractor | undefined {
    return this.extractors.find((e) => e.canHandle(el));
  }

  all(): readonly NodeExtractor[] {
    return [...this.extractors];
  }
}
