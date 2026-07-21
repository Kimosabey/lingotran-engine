/**
 * Completeness validator (placeholder).
 *
 * Produces the {@link CompletenessReport}: tallies node counts, compares
 * against expected counts, flags missing sections, and decides
 * `incomplete`. This is the web analogue of the French adversarial-QA
 * verdict. Concrete counting/heuristics are implemented in phase 2.
 */
import type { ContentNode } from '../models/content-node.model.js';
import type { PageAssets } from '../models/page-document.model.js';
import type { CompletenessReport } from '../models/completeness-report.model.js';

/** The minimum a completeness verdict needs — computed before assembly. */
export interface CompletenessInput {
  readonly nodes: ContentNode[];
  readonly assets: PageAssets;
  readonly duplicatesRemoved: number;
  readonly retries: number;
  /** Optional expected counts from a prior run / heuristic. */
  readonly expected?: CompletenessReport['expected'];
}

export interface CompletenessValidator {
  /** Compute a completeness report for a freshly-extracted page. */
  evaluate(input: CompletenessInput): CompletenessReport;
}

export abstract class BaseCompletenessValidator implements CompletenessValidator {
  abstract evaluate(input: CompletenessInput): CompletenessReport;
}
