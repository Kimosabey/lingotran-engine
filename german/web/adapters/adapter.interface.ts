/**
 * Website adapter port — the single extension point of this engine.
 *
 * Adding a new German website means implementing ONE adapter; the shared
 * pipeline, parsers, extractors, transformers and validators never change
 * (Open/Closed Principle). An adapter is DECLARATIVE: it returns selectors,
 * render hints and classification — it contains no scraping loop.
 *
 * The foundation ships only the abstract base, a generic fallback and a
 * template. No real site adapter (and therefore no real selector) is
 * included yet.
 */
import type {
  RenderMode,
  ExamType,
  CefrLevel,
  SkillSection,
  ContentType,
} from '../models/enums.js';

/** What an adapter can do — drives which pipeline stages run and how. */
export interface AdapterCapabilities {
  /** Preferred load strategy: static fetch, dynamic browser render, or auto. */
  readonly renderMode: RenderMode;
  /** Whether pages require an authenticated session (opt-in; see AuthSpec). */
  readonly requiresAuth: boolean;
  /** Whether the site exposes a sitemap for discovery. */
  readonly supportsSitemap: boolean;
  /** Whether change-detection / incremental re-extraction is meaningful. */
  readonly supportsIncremental: boolean;
}

/** Hints the loader uses when rendering a page. */
export interface RenderHints {
  readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  readonly timeoutMs?: number;
  /** Cookie/consent dialog selectors to dismiss before extraction. */
  readonly dismissSelectors?: string[];
  /** Selector that signals the primary content has rendered. */
  readonly waitForSelector?: string;
}

/** A dynamic-UI element to expand so hidden content becomes extractable. */
export interface ExpansionTarget {
  /** CSS selector for accordions / tabs / "show more" toggles. */
  readonly selector: string;
  readonly action: 'click' | 'hover';
  readonly waitAfterMs?: number;
  readonly description?: string;
}

/** Where the content is and what extra chrome to strip (site-agnostic core keeps a default list). */
export interface ContentSelectors {
  /** Candidate roots for the primary content region (first match wins). */
  readonly contentRoot: string[];
  /** Extra ignore selectors layered on top of the global default list. */
  readonly ignore: string[];
}

/** Lightweight, framework-free hints for classification (no DOM types). */
export interface ClassificationHints {
  readonly title?: string;
  readonly text?: string;
}

/** Editorial classification an adapter infers for a page. */
export interface PageClassification {
  readonly exam: ExamType;
  readonly level: CefrLevel;
  readonly section?: SkillSection;
  readonly contentType: ContentType[];
}

/**
 * Declarative login recipe (only consulted when `capabilities.requiresAuth`).
 * Credentials are resolved separately via CredentialProvider at runtime —
 * they are NEVER part of the adapter or this spec.
 */
export interface AuthSpec {
  readonly loginUrl: string;
  readonly usernameSelector: string;
  readonly passwordSelector: string;
  readonly submitSelector: string;
  /** Selector proving the session is authenticated. */
  readonly successSelector: string;
}

export interface SiteAdapter {
  /** Stable kebab-case id, e.g. "deutsch-pruefung". */
  readonly id: string;
  /** Hostnames this adapter handles. */
  readonly hostnames: string[];
  readonly capabilities: AdapterCapabilities;

  /** Dispatch: does this adapter own `url`? */
  matches(url: URL): boolean;

  // --- discovery ---
  /** Explicit entry URLs (used when no sitemap, or to augment it). */
  seedUrls(): string[];
  /** Absolute sitemap URL, or null. */
  sitemapUrl(): string | null;
  /** Site-level allow/deny on top of robots.txt (e.g. skip pagination noise). */
  shouldCrawl(url: URL): boolean;

  // --- rendering ---
  renderHints(url: URL): RenderHints;
  /** Dynamic elements to expand before extraction. */
  expansionTargets(url: URL): ExpansionTarget[];

  // --- detection ---
  selectorsFor(url: URL): ContentSelectors;

  // --- classification & identity ---
  classify(url: URL, hints?: ClassificationHints): PageClassification;
  /** Corpus slug for a URL (kebab-case, stable). */
  slugFor(url: URL): string;

  // --- optional auth ---
  authSpec?(): AuthSpec;
}
