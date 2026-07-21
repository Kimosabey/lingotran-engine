import { describe, it, expect } from 'vitest';
import { AdapterRegistry } from '../../../adapters/adapter.registry.js';
import { GenericAdapter } from '../../../adapters/generic.adapter.js';
import { BaseAdapter } from '../../../adapters/base.adapter.js';

class FakeAdapter extends BaseAdapter {
  readonly id = 'fake';
  readonly hostnames = ['example.de'];
}

describe('AdapterRegistry', () => {
  it('resolves a registered adapter by hostname', () => {
    const registry = new AdapterRegistry(new GenericAdapter()).register(new FakeAdapter());
    const resolved = registry.resolve(new URL('https://example.de/goethe'));
    expect(resolved.id).toBe('fake');
  });

  it('falls back when no adapter matches', () => {
    const registry = new AdapterRegistry(new GenericAdapter());
    const resolved = registry.resolve(new URL('https://unknown.de/'));
    expect(resolved.id).toBe('generic');
  });

  it('rejects duplicate adapter ids', () => {
    const registry = new AdapterRegistry(new GenericAdapter()).register(new FakeAdapter());
    expect(() => registry.register(new FakeAdapter())).toThrowError(/already registered/);
  });
});
