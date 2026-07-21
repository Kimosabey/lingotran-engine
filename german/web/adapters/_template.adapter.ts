/**
 * ADAPTER TEMPLATE — copy this file to create a new German website adapter.
 *
 *   1. Copy to `<site-id>.adapter.ts` (e.g. `deutsch-pruefung.adapter.ts`).
 *   2. Fill in id, hostnames, capabilities and the TODO selectors — read the
 *      real selectors from the live DOM during the implementation phase.
 *   3. Register it in the composition root:
 *          registry.register(new DeutschPruefungAdapter())
 *      and enable it in `config/websites.config.ts`.
 *
 * The shared pipeline requires NO changes. This template ships with NO real
 * selectors on purpose — it is not a live adapter.
 *
 * See `adapters/README.md` and `../ADDING_A_WEBSITE.md`.
 */
import { BaseAdapter } from './base.adapter.js';
import type {
  AdapterCapabilities,
  RenderHints,
  ExpansionTarget,
  ContentSelectors,
  ClassificationHints,
  PageClassification,
} from './adapter.interface.js';

export class TemplateAdapter extends BaseAdapter {
  readonly id = 'template'; // TODO: unique kebab-case id
  readonly hostnames: string[] = []; // TODO: e.g. ['example.de', 'www.example.de']

  override readonly capabilities: AdapterCapabilities = {
    // TODO: 'static' for server-HTML sites, 'dynamic' for Next.js/SPA sites.
    renderMode: 'auto',
    requiresAuth: false,
    supportsSitemap: false,
    supportsIncremental: true,
  };

  override sitemapUrl(): string | null {
    return null; // TODO: e.g. 'https://example.de/sitemap.xml'
  }

  override seedUrls(): string[] {
    return []; // TODO: entry URLs if no sitemap
  }

  override shouldCrawl(_url: URL): boolean {
    return true; // TODO: skip known-noise paths (pagination, tag archives…)
  }

  override renderHints(_url: URL): RenderHints {
    // TODO: consent/cookie dismiss selectors, content-ready selector, waits.
    return {};
  }

  override expansionTargets(_url: URL): ExpansionTarget[] {
    // TODO: selectors for accordions / tabs / "show more" to expand.
    return [];
  }

  override selectorsFor(_url: URL): ContentSelectors {
    // TODO: the site's real content root + extra chrome to ignore.
    return { contentRoot: ['main', 'article'], ignore: [] };
  }

  override classify(_url: URL, _hints?: ClassificationHints): PageClassification {
    // TODO: infer exam / level / section / content_type from url + hints.
    return { exam: 'unknown', level: 'unknown', contentType: ['unknown'] };
  }
}
