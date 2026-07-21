/**
 * HTML parser port + a minimal DOM facade.
 *
 * The facade (`ParsedDocument` / `ParsedElement`) decouples the extractors
 * from any concrete parsing library (linkedom, cheerio, or Playwright's own
 * DOM). Swapping the parser never touches extractor code — it only needs a
 * new implementation of this port.
 */

/** A read-only element in the parsed tree. */
export interface ParsedElement {
  readonly tagName: string;
  /** Visible text content (whitespace handling per parser config). */
  text(): string;
  /** Inner HTML, when formatting must be preserved. */
  html(): string;
  attr(name: string): string | null;
  querySelector(selector: string): ParsedElement | null;
  querySelectorAll(selector: string): ParsedElement[];
  children(): ParsedElement[];
}

/** A parsed document rooted at `root`, aware of its base URL. */
export interface ParsedDocument {
  readonly baseUrl: string;
  readonly root: ParsedElement;
  querySelector(selector: string): ParsedElement | null;
  querySelectorAll(selector: string): ParsedElement[];
}

export interface HtmlParser {
  /** Parse HTML into the DOM facade. Pure — no network, no side effects. */
  parse(html: string, baseUrl: string): ParsedDocument;
}
