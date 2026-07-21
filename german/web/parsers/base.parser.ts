/**
 * Abstract base for HTML parsers.
 *
 * Concrete parsers (e.g. a linkedom-backed parser, added in phase 2) extend
 * this and implement `parse`. Shared, library-agnostic helpers can live here
 * as the implementation grows (e.g. whitespace normalisation).
 */
import type { HtmlParser, ParsedDocument } from './parser.interface.js';

export abstract class BaseHtmlParser implements HtmlParser {
  abstract parse(html: string, baseUrl: string): ParsedDocument;

  /**
   * Collapse insignificant whitespace while preserving single spaces.
   * Shared helper for concrete parsers; callers opt in.
   */
  protected normalizeWhitespace(text: string): string {
    return text.replace(/[ \t\r\n]+/g, ' ').trim();
  }
}
