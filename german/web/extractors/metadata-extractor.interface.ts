/**
 * Metadata-extraction port.
 *
 * Reads page-level metadata (title, description, canonical, lang, open-graph
 * / meta tags) from the parsed document and merges it with the adapter's
 * classification (exam / level / section / content_type) into a
 * `PageMetadata`. Site-agnostic: standard `<head>` semantics only.
 */
import type { ParsedDocument } from '../parsers/parser.interface.js';
import type { PageClassification } from '../adapters/adapter.interface.js';
import type { PageMetadata } from '../models/metadata.model.js';

export interface MetadataExtractor {
  extract(
    doc: ParsedDocument,
    url: URL,
    classification: PageClassification,
    slug: string,
  ): PageMetadata;
}
