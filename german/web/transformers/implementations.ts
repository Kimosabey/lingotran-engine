/**
 * Concrete transformers + serializers.
 *
 *  - ContentTransformerImpl : NFC-normalises text and de-duplicates repeated
 *                             heading/paragraph/quote blocks.
 *  - DocumentAssemblerImpl  : composes the final PageDocument (+ wordCount,
 *                             status/qa derived from the completeness report).
 *  - MarkdownSerializerImpl : Lingotran-compatible Markdown + YAML frontmatter.
 *  - JsonSerializerImpl     : the structured PageDocument as pretty JSON.
 */
import type { ContentNode, ListItem } from '../models/content-node.model.js';
import type { PageDocument } from '../models/page-document.model.js';
import { BaseContentTransformer } from './base.transformer.js';
import type {
  TransformContext,
  TransformResult,
  DocumentAssembler,
  AssembleInput,
} from './transformer.interface.js';
import type { MarkdownSerializer, JsonSerializer } from './serializer.interface.js';

export class ContentTransformerImpl extends BaseContentTransformer {
  transform(nodes: ContentNode[], ctx: TransformContext): TransformResult {
    const seen = new Set<string>();
    const out: ContentNode[] = [];
    let duplicatesRemoved = 0;

    for (const node of nodes) {
      const normalized = ctx.normalizeUnicode ? this.normalize(node) : node;
      const key = this.dedupeKey(normalized);
      if (ctx.dedupe && key && seen.has(key)) {
        duplicatesRemoved += 1;
        continue;
      }
      if (key) seen.add(key);
      out.push({ ...normalized, order: out.length } as ContentNode);
    }
    return { nodes: out, duplicatesRemoved };
  }

  private dedupeKey(node: ContentNode): string | null {
    switch (node.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        return `${node.type}:${node.text}`;
      default:
        return null;
    }
  }

  private normalize(node: ContentNode): ContentNode {
    const n = (s: string): string => this.toNfc(s);
    switch (node.type) {
      case 'heading':
        return { ...node, text: n(node.text) };
      case 'paragraph':
        return { ...node, text: n(node.text) };
      case 'quote':
        return { ...node, text: n(node.text) };
      case 'code':
        return { ...node, text: n(node.text) };
      case 'list':
        return { ...node, items: node.items.map((i) => this.normalizeItem(i)) };
      case 'table':
        return {
          ...node,
          headers: node.headers.map((r) => r.map(n)),
          rows: node.rows.map((r) => r.map(n)),
          ...(node.caption ? { caption: n(node.caption) } : {}),
        };
      case 'figure':
        return node.caption ? { ...node, caption: n(node.caption) } : node;
      default:
        return node;
    }
  }

  private normalizeItem(item: ListItem): ListItem {
    const text = this.toNfc(item.text);
    return item.children
      ? { text, children: item.children.map((c) => this.normalizeItem(c)) }
      : { text };
  }
}

export class DocumentAssemblerImpl implements DocumentAssembler {
  assemble(input: AssembleInput): PageDocument {
    const wordCount = this.countWords(input.nodes);
    const metadata = {
      ...input.metadata,
      wordCount,
      fetchedAt: input.metadata.fetchedAt ?? new Date().toISOString(),
    };
    const incomplete = input.completeness.incomplete;
    return {
      metadata,
      nodes: input.nodes,
      assets: input.assets,
      completeness: input.completeness,
      provenance: input.provenance,
      status: incomplete ? 'failed' : 'verified',
      qa: incomplete ? 'fail' : 'pass',
    };
  }

  private countWords(nodes: ContentNode[]): number {
    let total = 0;
    const add = (s: string): void => {
      const w = s.trim().split(/\s+/).filter(Boolean).length;
      total += w;
    };
    for (const node of nodes) {
      if (node.type === 'heading' || node.type === 'paragraph' || node.type === 'quote') add(node.text);
      else if (node.type === 'list') node.items.forEach((i) => add(i.text));
      else if (node.type === 'table') node.rows.forEach((r) => r.forEach(add));
    }
    return total;
  }
}

/* --------------------------- Serializers ------------------------------- */

function yamlStr(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export class MarkdownSerializerImpl implements MarkdownSerializer {
  readonly format = 'markdown' as const;

  serialize(doc: PageDocument): string {
    return `${this.frontmatter(doc)}\n${this.body(doc.nodes)}`;
  }

  private frontmatter(doc: PageDocument): string {
    const m = doc.metadata;
    const lines = [
      '---',
      `source_url: ${m.sourceUrl}`,
      `site: ${m.site}`,
      `slug: ${m.slug}`,
      `title: ${yamlStr(m.title)}`,
      `exam: ${m.exam}`,
      `level: ${m.level}`,
      ...(m.section ? [`section: ${m.section}`] : []),
      `content_type: [${m.contentType.join(', ')}]`,
      `status: ${doc.status}`,
      `qa: ${doc.qa}`,
      ...(m.fetchedAt ? [`fetched_at: ${m.fetchedAt}`] : []),
      '---',
    ];
    return lines.join('\n');
  }

  private body(nodes: ContentNode[]): string {
    return nodes.map((n) => this.node(n)).filter(Boolean).join('\n\n') + '\n';
  }

  private node(node: ContentNode): string {
    switch (node.type) {
      case 'heading':
        return `${'#'.repeat(node.level)} ${node.text}`;
      case 'paragraph':
        return node.text;
      case 'quote':
        return node.text.split('\n').map((l) => `> ${l}`).join('\n');
      case 'code':
        return '```\n' + node.text + '\n```';
      case 'list':
        return this.list(node.items, node.ordered, 0);
      case 'table':
        return this.table(node);
      case 'image':
        return `![${node.alt}](${node.src})`;
      case 'figure':
        return `![${node.caption ?? node.image.alt}](${node.image.src})` +
          (node.caption ? `\n*${node.caption}*` : '');
      case 'media':
        return `[${node.kind}](${node.src})`;
      case 'section':
        return (node.heading ? `## ${node.heading}\n\n` : '') + this.body(node.children);
      default:
        return '';
    }
  }

  private list(items: ListItem[], ordered: boolean, depth: number): string {
    const pad = '  '.repeat(depth);
    return items
      .map((it, i) => {
        const marker = ordered ? `${i + 1}.` : '-';
        const line = `${pad}${marker} ${it.text}`;
        const nested = it.children?.length ? '\n' + this.list(it.children, ordered, depth + 1) : '';
        return line + nested;
      })
      .join('\n');
  }

  private table(node: { headers: string[][]; rows: string[][]; caption?: string }): string {
    const header = node.headers[0] ?? node.rows[0] ?? [];
    const bodyRows = node.headers.length > 0 ? node.rows : node.rows.slice(1);
    if (header.length === 0) return '';
    const head = `| ${header.join(' | ')} |`;
    const sep = `| ${header.map(() => '---').join(' | ')} |`;
    const body = bodyRows.map((r) => `| ${r.join(' | ')} |`).join('\n');
    const caption = node.caption ? `*${node.caption}*\n\n` : '';
    return `${caption}${head}\n${sep}\n${body}`;
  }
}

export class JsonSerializerImpl implements JsonSerializer {
  readonly format = 'json' as const;
  serialize(doc: PageDocument): string {
    return JSON.stringify(doc, null, 2);
  }
}
