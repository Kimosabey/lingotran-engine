/**
 * Adapter registry.
 *
 * The composition root registers concrete adapters here; the pipeline
 * resolves the right one per URL. New sites are added by `register(...)`ing
 * an adapter — the registry and pipeline code never change (Open/Closed).
 */
import type { SiteAdapter } from './adapter.interface.js';

export class AdapterRegistry {
  private readonly adapters: SiteAdapter[] = [];

  constructor(private readonly fallback: SiteAdapter) {}

  /** Register an adapter. Throws on duplicate id to catch mistakes early. */
  register(adapter: SiteAdapter): this {
    if (this.adapters.some((a) => a.id === adapter.id)) {
      throw new Error(`Adapter id already registered: ${adapter.id}`);
    }
    this.adapters.push(adapter);
    return this;
  }

  /** Resolve the adapter that owns `url`, or the fallback. */
  resolve(url: URL): SiteAdapter {
    return this.adapters.find((a) => a.matches(url)) ?? this.fallback;
  }

  /** All registered adapters (excludes the fallback). */
  all(): readonly SiteAdapter[] {
    return [...this.adapters];
  }
}
