/**
 * Concrete extraction implementations: content detection, DOM walking, and
 * metadata extraction. Generic HTML semantics only — any per-site behaviour
 * arrives via the adapter-provided `ExtractionContext`, never hardcoded here.
 */
import type { ParsedDocument, ParsedElement } from '../parsers/parser.interface.js';
import type {
  ContentDetector,
  ExtractionContext,
} from './content-extractor.interface.js';
import { AbstractContentExtractor } from './base.extractor.js';
import type { ContentNode } from '../models/content-node.model.js';
import type { MetadataExtractor } from './metadata-extractor.interface.js';
import type { PageClassification } from '../adapters/adapter.interface.js';
import type { PageMetadata } from '../models/metadata.model.js';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Structural chrome skipped during the walk (site-agnostic). */
const IGNORE_TAGS = new Set([
  'nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript',
  'svg', 'template',
]);
const IGNORE_ROLES = new Set([
  'banner', 'navigation', 'contentinfo', 'search', 'complementary',
]);

export class HeuristicContentDetector implements ContentDetector {
  detect(doc: ParsedDocument, ctx: ExtractionContext): ParsedElement | null {
    for (const selector of ctx.selectors.contentRoot) {
      const found = doc.querySelector(selector);
      if (found) return found;
    }
    // Fallback: the document body (root of the facade).
    return doc.root;
  }
}

export class DomContentExtractor extends AbstractContentExtractor {
  extract(root: ParsedElement, _ctx: ExtractionContext): ContentNode[] {
    this.counter = 0;
    const out: ContentNode[] = [];

    const visit = (el: ParsedElement): void => {
      for (const child of el.children()) {
        if (this.isIgnored(child)) continue;
        const extractor = this.nodes.resolve(child);
        if (extractor) {
          const node = extractor.extract(child, out.length, () => this.assignId());
          if (node) out.push(node);
          // Recognized blocks are terminal — do not descend into them.
        } else {
          visit(child);
        }
      }
    };

    visit(root);
    return out;
  }

  private isIgnored(el: ParsedElement): boolean {
    if (IGNORE_TAGS.has(el.tagName)) return true;
    const role = el.attr('role');
    if (role && IGNORE_ROLES.has(role)) return true;
    return el.attr('aria-hidden') === 'true';
  }
}

export class MetadataExtractorImpl implements MetadataExtractor {
  extract(
    doc: ParsedDocument,
    url: URL,
    classification: PageClassification,
    slug: string,
  ): PageMetadata {
    const meta: Record<string, string> = {};
    for (const m of doc.querySelectorAll('meta')) {
      const key = m.attr('property') ?? m.attr('name');
      const val = m.attr('content');
      if (key && val) meta[key.toLowerCase()] = val;
    }

    const titleEl = doc.querySelector('title');
    const title = norm(titleEl?.text() ?? meta['og:title'] ?? slug);
    const canonical = doc.querySelector('link[rel="canonical"]')?.attr('href') ?? undefined;
    const lang = doc.querySelector('html')?.attr('lang') ?? undefined;

    return {
      sourceUrl: url.href,
      canonicalUrl: canonical,
      site: url.hostname,
      slug,
      sourceType: 'web',
      title,
      description: meta['description'] ?? meta['og:description'],
      lang,
      exam: classification.exam,
      level: classification.level,
      section: classification.section,
      contentType: classification.contentType,
      meta,
    };
  }
}
