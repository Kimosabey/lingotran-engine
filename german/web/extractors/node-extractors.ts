/**
 * Concrete per-node extractors (one small class per block family) + a
 * factory that assembles the default registry in resolution order.
 *
 * Generic HTML semantics only — no site-specific selectors.
 */
import type { ParsedElement } from '../parsers/parser.interface.js';
import type { NodeExtractor } from './node-extractor.interface.js';
import { NodeExtractorRegistry } from './node-extractor.registry.js';
import type {
  HeadingNode,
  ParagraphNode,
  ListNode,
  ListItem,
  TableNode,
  ImageNode,
  FigureNode,
  MediaNode,
  QuoteNode,
  CodeNode,
} from '../models/content-node.model.js';
import type { MediaKind } from '../models/enums.js';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

export class HeadingExtractor implements NodeExtractor<HeadingNode> {
  readonly nodeType = 'heading' as const;
  canHandle(el: ParsedElement): boolean {
    return HEADINGS.has(el.tagName);
  }
  extract(el: ParsedElement, order: number, assignId: () => string): HeadingNode | null {
    const text = norm(el.text());
    if (!text) return null;
    const level = Number(el.tagName[1]) as HeadingNode['level'];
    return { id: assignId(), type: 'heading', order, level, text };
  }
}

export class ParagraphExtractor implements NodeExtractor<ParagraphNode> {
  readonly nodeType = 'paragraph' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'p';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): ParagraphNode | null {
    const text = norm(el.text());
    if (!text) return null;
    return { id: assignId(), type: 'paragraph', order, text };
  }
}

function parseItems(listEl: ParsedElement): ListItem[] {
  return listEl
    .children()
    .filter((c) => c.tagName === 'li')
    .map((li): ListItem => {
      const nested = li.children().find((c) => c.tagName === 'ul' || c.tagName === 'ol');
      const text = norm(li.text());
      return nested ? { text, children: parseItems(nested) } : { text };
    });
}

export class ListExtractor implements NodeExtractor<ListNode> {
  readonly nodeType = 'list' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'ul' || el.tagName === 'ol';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): ListNode | null {
    const items = parseItems(el).filter((i) => i.text.length > 0);
    if (items.length === 0) return null;
    return { id: assignId(), type: 'list', order, ordered: el.tagName === 'ol', items };
  }
}

export class TableExtractor implements NodeExtractor<TableNode> {
  readonly nodeType = 'table' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'table';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): TableNode | null {
    const headers = el
      .querySelectorAll('thead tr')
      .map((tr) => tr.querySelectorAll('th').map((c) => norm(c.text())))
      .filter((r) => r.length > 0);
    let bodyRows = el.querySelectorAll('tbody tr');
    if (bodyRows.length === 0) bodyRows = el.querySelectorAll('tr');
    const rows = bodyRows
      .map((tr) => tr.querySelectorAll('td, th').map((c) => norm(c.text())))
      .filter((r) => r.some((cell) => cell.length > 0));
    if (rows.length === 0 && headers.length === 0) return null;
    const caption = el.querySelector('caption');
    const node: TableNode = { id: assignId(), type: 'table', order, headers, rows };
    if (caption) return { ...node, caption: norm(caption.text()) };
    return node;
  }
}

export class FigureExtractor implements NodeExtractor<FigureNode> {
  readonly nodeType = 'figure' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'figure';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): FigureNode | null {
    const img = el.querySelector('img');
    if (!img) return null;
    const src = img.attr('src') ?? img.attr('data-src') ?? '';
    if (!src) return null;
    const cap = el.querySelector('figcaption');
    const image = { src, alt: img.attr('alt') ?? '' };
    const node: FigureNode = { id: assignId(), type: 'figure', order, image };
    if (cap) return { ...node, caption: norm(cap.text()) };
    return node;
  }
}

export class ImageExtractor implements NodeExtractor<ImageNode> {
  readonly nodeType = 'image' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'img';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): ImageNode | null {
    const src = el.attr('src') ?? el.attr('data-src') ?? '';
    if (!src) return null;
    return { id: assignId(), type: 'image', order, src, alt: el.attr('alt') ?? '' };
  }
}

const MEDIA_TAGS: Record<string, MediaKind> = {
  audio: 'audio',
  video: 'video',
  iframe: 'iframe',
};

export class MediaExtractor implements NodeExtractor<MediaNode> {
  readonly nodeType = 'media' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName in MEDIA_TAGS;
  }
  extract(el: ParsedElement, order: number, assignId: () => string): MediaNode | null {
    const kind = MEDIA_TAGS[el.tagName];
    if (!kind) return null;
    const src = el.attr('src') ?? el.querySelector('source')?.attr('src') ?? '';
    if (!src) return null;
    return { id: assignId(), type: 'media', order, kind, src };
  }
}

export class QuoteExtractor implements NodeExtractor<QuoteNode> {
  readonly nodeType = 'quote' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'blockquote';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): QuoteNode | null {
    const text = norm(el.text());
    if (!text) return null;
    const cite = el.attr('cite');
    const node: QuoteNode = { id: assignId(), type: 'quote', order, text };
    return cite ? { ...node, cite } : node;
  }
}

export class CodeExtractor implements NodeExtractor<CodeNode> {
  readonly nodeType = 'code' as const;
  canHandle(el: ParsedElement): boolean {
    return el.tagName === 'pre';
  }
  extract(el: ParsedElement, order: number, assignId: () => string): CodeNode | null {
    // Preserve whitespace verbatim for code.
    const text = el.text().replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
    if (!text.trim()) return null;
    return { id: assignId(), type: 'code', order, text };
  }
}

/** Registry in resolution order (specific before generic). */
export function defaultNodeRegistry(): NodeExtractorRegistry {
  return new NodeExtractorRegistry()
    .register(new HeadingExtractor())
    .register(new ParagraphExtractor())
    .register(new FigureExtractor())
    .register(new TableExtractor())
    .register(new ListExtractor())
    .register(new MediaExtractor())
    .register(new QuoteExtractor())
    .register(new CodeExtractor())
    .register(new ImageExtractor());
}
