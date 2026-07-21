/**
 * Schema validator.
 *
 * Validates a candidate `PageDocument` against the zod output schema before
 * it is emitted, guaranteeing every corpus artifact conforms to the output
 * contract. This one is implemented (it is generic infrastructure, not
 * scraping logic) so the output schema is enforceable from day one.
 */
import type { PageDocument } from '../models/page-document.model.js';
import { pageDocumentSchema } from '../schemas/page-document.schema.js';
import type {
  Validator,
  ValidationResult,
  ValidationIssue,
} from './validator.interface.js';

export class SchemaValidator implements Validator<unknown> {
  validate(input: unknown): ValidationResult {
    const result = pageDocumentSchema.safeParse(input);
    if (result.success) {
      return { ok: true, issues: [] };
    }
    const issues: ValidationIssue[] = result.error.issues.map((i) => ({
      severity: 'error',
      message: i.message,
      path: i.path.join('.'),
    }));
    return { ok: false, issues };
  }

  /** Parse + return the typed document, throwing on invalid input. */
  parse(input: unknown): PageDocument {
    return pageDocumentSchema.parse(input) as PageDocument;
  }
}
