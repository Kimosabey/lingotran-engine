/**
 * Output serialization ports.
 *
 * Two serializers turn a `PageDocument` into corpus artifacts, matching the
 * existing Lingotran conventions:
 *   - MarkdownSerializer → `<slug>.md` with YAML frontmatter + a faithful
 *     Markdown body (the human-readable, French-compatible corpus file).
 *   - JsonSerializer → the structured `PageDocument` as JSON (the machine
 *     artifact for study tools / future AI processing).
 */
import type { PageDocument } from '../models/page-document.model.js';

export type OutputFormat = 'markdown' | 'json';

export interface Serializer<TOut = string> {
  readonly format: OutputFormat;
  serialize(doc: PageDocument): TOut;
}

export interface MarkdownSerializer extends Serializer<string> {
  readonly format: 'markdown';
}

export interface JsonSerializer extends Serializer<string> {
  readonly format: 'json';
}
