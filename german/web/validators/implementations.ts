/**
 * Concrete completeness validator: tallies node/asset counts and decides
 * whether an extraction is partial. Web analogue of the French adversarial-QA
 * verdict (zero-data-loss intent).
 */
import type { ContentNode } from '../models/content-node.model.js';
import type { NodeCounts, CompletenessReport } from '../models/completeness-report.model.js';
import {
  BaseCompletenessValidator,
  type CompletenessInput,
} from './completeness.validator.js';

export class CompletenessValidatorImpl extends BaseCompletenessValidator {
  evaluate(input: CompletenessInput): CompletenessReport {
    const counts = this.count(input.nodes, input.assets.links);
    const warnings: string[] = [];

    const hasText = counts.headings + counts.paragraphs + counts.lists + counts.tables > 0;
    if (!hasText) warnings.push('No headings/paragraphs/lists/tables found in the primary content.');

    const incomplete = !hasText;

    return {
      counts,
      ...(input.expected ? { expected: input.expected } : {}),
      missingSections: [],
      duplicatesRemoved: input.duplicatesRemoved,
      retries: input.retries,
      incomplete,
      warnings,
    };
  }

  private count(nodes: ContentNode[], links: { kind?: string }[]): NodeCounts {
    // Mutable accumulator; returned as the readonly NodeCounts.
    const c = {
      headings: 0, paragraphs: 0, lists: 0, tables: 0,
      images: 0, figures: 0, media: 0, links: 0, downloads: 0,
    };
    const walk = (list: ContentNode[]): void => {
      for (const n of list) {
        switch (n.type) {
          case 'heading': c.headings++; break;
          case 'paragraph': c.paragraphs++; break;
          case 'list': c.lists++; break;
          case 'table': c.tables++; break;
          case 'image': c.images++; break;
          case 'figure': c.figures++; break;
          case 'media': c.media++; break;
          case 'section': walk(n.children); break;
          default: break;
        }
      }
    };
    walk(nodes);
    c.links = (links as { kind?: string }[]).length;
    c.downloads = (links as { kind?: string }[]).filter((l) => l.kind === 'download').length;
    return c;
  }
}
