/**
 * Generic validator port.
 *
 * A `Validator<T>` inspects a value and returns a structured result rather
 * than throwing, so the pipeline can decide whether to fail, warn, or route
 * a page to a repair/enrichment stage (mirroring the French adversarial-QA
 * repair loop).
 */
export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  readonly message: string;
  readonly severity: IssueSeverity;
  /** Optional dotted path into the validated value. */
  readonly path?: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: ValidationIssue[];
}

export interface Validator<TInput> {
  validate(input: TInput): ValidationResult;
}
