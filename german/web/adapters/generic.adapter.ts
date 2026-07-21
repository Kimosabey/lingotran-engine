/**
 * Generic fallback adapter.
 *
 * Used by the registry when no site-specific adapter matches a URL. Relies
 * entirely on the base defaults + a heuristic content detector (Readability
 * in the eventual implementation). It matches nothing by hostname — the
 * registry selects it explicitly as the fallback.
 */
import { BaseAdapter } from './base.adapter.js';

export class GenericAdapter extends BaseAdapter {
  readonly id = 'generic';
  readonly hostnames: string[] = [];

  override matches(_url: URL): boolean {
    // Never auto-matches; only used as the registry's explicit fallback.
    return false;
  }
}
