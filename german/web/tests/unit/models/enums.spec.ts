import { describe, it, expect } from 'vitest';
import {
  NODE_TYPES,
  CONTENT_TYPES,
  EXAM_TYPES,
  CEFR_LEVELS,
  RENDER_MODES,
  SOURCE_TYPES,
} from '../../../models/enums.js';

describe('domain enums', () => {
  it('have no duplicate values', () => {
    for (const arr of [NODE_TYPES, CONTENT_TYPES, EXAM_TYPES, CEFR_LEVELS, RENDER_MODES]) {
      expect(new Set(arr).size).toBe(arr.length);
    }
  });

  it('support both static and dynamic render modes', () => {
    expect(RENDER_MODES).toContain('static');
    expect(RENDER_MODES).toContain('dynamic');
    expect(RENDER_MODES).toContain('auto');
  });

  it('reserve future source channels alongside web', () => {
    expect(SOURCE_TYPES).toContain('web');
    expect(SOURCE_TYPES).toContain('pdf');
    expect(SOURCE_TYPES).toContain('ocr');
  });
});
