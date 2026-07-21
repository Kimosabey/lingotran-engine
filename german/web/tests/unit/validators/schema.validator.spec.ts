import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../validators/schema.validator.js';

describe('SchemaValidator', () => {
  const validator = new SchemaValidator();

  it('rejects a value that is not a PageDocument', () => {
    const result = validator.validate({ nope: true });
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]?.severity).toBe('error');
  });

  it('reports the offending path', () => {
    const result = validator.validate({ metadata: {}, nodes: [] });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path?.startsWith('metadata'))).toBe(true);
  });

  // Filled in phase 2 once a builder produces a complete PageDocument fixture.
  it.todo('accepts a fully-formed PageDocument');
});
