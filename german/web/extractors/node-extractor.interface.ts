/**
 * Per-node extractor port (Single Responsibility + Open/Closed).
 *
 * Each content-node family (heading, paragraph, list, table, image, figure,
 * media, link, quote, code) gets ONE small extractor. Supporting a new block
 * type = add a new `NodeExtractor` and register it — no existing code
 * changes. The `ContentExtractor` delegates each DOM element to the first
 * node extractor that `canHandle` it.
 */
import type { ParsedElement } from '../parsers/parser.interface.js';
import type { ContentNode } from '../models/content-node.model.js';
import type { NodeType } from '../models/enums.js';

export interface NodeExtractor<TNode extends ContentNode = ContentNode> {
  /** The node family this extractor produces. */
  readonly nodeType: NodeType;
  /** True if this extractor recognises `el`. */
  canHandle(el: ParsedElement): boolean;
  /**
   * Produce a node from `el` at reading position `order`, or null to skip.
   * `assignId` mints stable ids so extractors stay pure.
   */
  extract(el: ParsedElement, order: number, assignId: () => string): TNode | null;
}
