/**
 * deutsch-pruefung.de adapter — PUBLIC pages only.
 *
 * Scope is deliberately narrowed to robots-allowed, non-authenticated content
 * (exam overviews + skill/part pages + blog). The login-gated areas
 * (/dashboard, /practice, /auth, /profile) are DISALLOWED by the site's
 * robots.txt and are excluded here; `shouldCrawl` never widens past that.
 *
 * The public pages are server-rendered (Next.js SSR/SSG), so `auto` render
 * mode resolves to a plain static fetch — no browser required.
 */
import { BaseAdapter } from './base.adapter.js';
import type {
  AdapterCapabilities,
  ContentSelectors,
  RenderHints,
  ClassificationHints,
  PageClassification,
} from './adapter.interface.js';
import type {
  ExamType,
  CefrLevel,
  SkillSection,
  ContentType,
} from '../models/enums.js';

/** robots.txt Disallow prefixes — hard deny (never crawled). */
const ROBOTS_DISALLOW = [
  '/api', '/dashboard', '/admin', '/feedback', '/auth', '/email-preview',
  '/demo-feedback', '/practice', '/profile', '/unsubscribe', '/upgrade', '/maintenance',
];

/** Public content prefixes we intentionally crawl (allow-list). */
const PUBLIC_PREFIXES = ['/goethe', '/telc', '/dtz', '/testdaf', '/mock-test', '/blog'];

const EXAMS: Record<string, ExamType> = {
  goethe: 'goethe', telc: 'telc', dtz: 'dtz', testdaf: 'testdaf',
};
const SECTIONS: Record<string, SkillSection> = {
  lesen: 'lesen', hoeren: 'hoeren', schreiben: 'schreiben', sprechen: 'sprechen',
};

export class DeutschPruefungAdapter extends BaseAdapter {
  readonly id = 'deutsch-pruefung';
  readonly hostnames = ['deutsch-pruefung.de', 'www.deutsch-pruefung.de'];

  override readonly capabilities: AdapterCapabilities = {
    renderMode: 'auto', // SSR content → static; escalates only if empty
    requiresAuth: false,
    supportsSitemap: true,
    supportsIncremental: true,
  };

  override sitemapUrl(): string | null {
    return 'https://deutsch-pruefung.de/sitemap.xml';
  }

  override shouldCrawl(url: URL): boolean {
    const path = url.pathname.toLowerCase();
    if (ROBOTS_DISALLOW.some((p) => path === p || path.startsWith(`${p}/`))) return false;
    return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  }

  override renderHints(_url: URL): RenderHints {
    return { waitUntil: 'networkidle', waitForSelector: 'main' };
  }

  override selectorsFor(_url: URL): ContentSelectors {
    return { contentRoot: ['main', 'article', '[role="main"]'], ignore: [] };
  }

  override classify(url: URL, _hints?: ClassificationHints): PageClassification {
    const parts = url.pathname.toLowerCase().split('/').filter(Boolean);
    const exam: ExamType = EXAMS[parts[0] ?? ''] ?? 'unknown';

    const levelPart = parts.find((p) => /^(a1|a2|b1|b2|c1|c2)$/.test(p));
    const level = (levelPart?.toUpperCase() ?? 'unknown') as CefrLevel;

    const sectionPart = parts.find((p) => p in SECTIONS);
    const section = sectionPart ? SECTIONS[sectionPart] : undefined;

    let contentType: ContentType[];
    if (parts[0] === 'blog') contentType = parts.length > 1 ? ['blog-article'] : ['landing'];
    else if (parts.includes('mock-test')) contentType = ['mock-test-info'];
    else if (section) contentType = ['exam-section'];
    else if (exam !== 'unknown') contentType = ['exam-overview'];
    else contentType = ['landing'];

    return section ? { exam, level, section, contentType } : { exam, level, contentType };
  }
}
