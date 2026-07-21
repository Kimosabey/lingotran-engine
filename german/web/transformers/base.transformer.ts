/**
 * Abstract base for content transformers.
 *
 * Provides shared, framework-free helpers (Unicode normalisation) and
 * declares the transform contract. Concrete cleaning/dedupe logic is added
 * in phase 2.
 */
import type { ContentNode } from '../models/content-node.model.js';
import type {
  ContentTransformer,
  TransformContext,
  TransformResult,
} from './transformer.interface.js';

export abstract class BaseContentTransformer implements ContentTransformer {
  abstract transform(nodes: ContentNode[], ctx: TransformContext): TransformResult;

  /** NFC-normalise so accents/umlauts are single, comparable code points. */
  protected toNfc(text: string): string {
    return text.normalize('NFC');
  }
}
