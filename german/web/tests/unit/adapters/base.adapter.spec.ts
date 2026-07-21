import { describe, it, expect } from 'vitest';
import { BaseAdapter } from '../../../adapters/base.adapter.js';

class FakeAdapter extends BaseAdapter {
  readonly id = 'fake';
  readonly hostnames = ['example.de'];
}

describe('BaseAdapter.slugFor', () => {
  const adapter = new FakeAdapter();

  it('produces a stable kebab-case slug from the path', () => {
    expect(adapter.slugFor(new URL('https://example.de/goethe/a1'))).toBe('goethe--a1');
  });

  it('maps the root path to "index"', () => {
    expect(adapter.slugFor(new URL('https://example.de/'))).toBe('index');
  });

  it('is site-agnostic (default content roots only)', () => {
    const selectors = adapter.selectorsFor(new URL('https://example.de/x'));
    expect(selectors.contentRoot).toContain('main');
    expect(selectors.ignore).toEqual([]);
  });
});
