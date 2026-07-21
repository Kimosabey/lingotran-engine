/**
 * Abstract base adapter.
 *
 * Provides safe, SITE-AGNOSTIC defaults for every adapter method so a
 * concrete adapter only overrides what actually differs for its site.
 * Contains NO selectors tuned to any real website — only semantic-HTML
 * defaults every well-formed page shares.
 */
import type {
  SiteAdapter,
  AdapterCapabilities,
  RenderHints,
  ExpansionTarget,
  ContentSelectors,
  ClassificationHints,
  PageClassification,
} from './adapter.interface.js';

export abstract class BaseAdapter implements SiteAdapter {
  abstract readonly id: string;
  abstract readonly hostnames: string[];

  readonly capabilities: AdapterCapabilities = {
    renderMode: 'auto',
    requiresAuth: false,
    supportsSitemap: false,
    supportsIncremental: true,
  };

  matches(url: URL): boolean {
    return this.hostnames.includes(url.hostname);
  }

  seedUrls(): string[] {
    return [];
  }

  sitemapUrl(): string | null {
    return null;
  }

  shouldCrawl(_url: URL): boolean {
    return true;
  }

  renderHints(_url: URL): RenderHints {
    return {};
  }

  expansionTargets(_url: URL): ExpansionTarget[] {
    return [];
  }

  /** Generic semantic-HTML content roots. Override per site if needed. */
  selectorsFor(_url: URL): ContentSelectors {
    return {
      contentRoot: ['main', 'article', '[role="main"]'],
      ignore: [],
    };
  }

  /** Default classification is "unknown"; concrete adapters refine it. */
  classify(_url: URL, _hints?: ClassificationHints): PageClassification {
    return { exam: 'unknown', level: 'unknown', contentType: ['unknown'] };
  }

  /**
   * URL → stable kebab-case slug. Generic (not site-specific): joins the
   * path segments, lower-cases, and strips unsafe characters.
   */
  slugFor(url: URL): string {
    const path = url.pathname.replace(/\/+$/, '').replace(/^\/+/, '');
    const base = path === '' ? 'index' : path;
    return base
      .toLowerCase()
      .replace(/[^a-z0-9/]+/g, '-') // invalid char runs → single dash
      .replace(/-+/g, '-') // collapse dashes WITHIN a segment first
      .replace(/\//g, '--') // path separators → double dash (kept distinct)
      .replace(/^-+|-+$/g, '');
  }
}
