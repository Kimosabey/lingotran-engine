/**
 * Website enablement configuration (placeholder).
 *
 * This is the ONLY place the engine learns which German websites to crawl.
 * It lists adapter ids to activate and optional per-site overrides for the
 * engine defaults (delay, concurrency, render mode). It contains NO
 * selectors and NO scraping rules — those are the adapter's responsibility.
 *
 * Adding a site later = implement its adapter, register it, and add one
 * entry here. The core pipeline never changes.
 */
import type { RenderMode } from '../models/enums.js';

export interface WebsiteOverride {
  /** Adapter id (matches `SiteAdapter.id`), e.g. "deutsch-pruefung". */
  readonly adapterId: string;
  readonly enabled: boolean;
  /** Optional politeness overrides for this host. */
  readonly requestDelayMs?: number;
  readonly maxConcurrency?: number;
  /** Force a render mode for this host (otherwise the adapter decides). */
  readonly renderMode?: RenderMode;
}

export interface WebsitesConfig {
  readonly sites: WebsiteOverride[];
}

/**
 * Empty by default — no site is crawled until an adapter is implemented and
 * enabled here. (deutsch-pruefung is intentionally NOT listed yet.)
 */
export const websitesConfig: WebsitesConfig = {
  sites: [],
};
