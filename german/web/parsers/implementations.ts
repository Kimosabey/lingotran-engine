/**
 * Concrete page loaders + HTML parser.
 *
 *  - StaticHtmlLoader   : plain HTTP fetch (used for server-rendered pages).
 *  - DynamicBrowserLoader: Playwright render (only when a site needs JS).
 *  - LoaderRouter       : picks the strategy from the request's render mode;
 *                         `auto` uses static and escalates to dynamic only if
 *                         the static HTML has almost no visible text.
 *  - LinkeDomParser     : linkedom-backed implementation of the DOM facade.
 */
import { parseHTML } from 'linkedom';
import type {
  PageLoader,
  LoadRequest,
  LoadedPage,
} from './page-loader.interface.js';
import type { Logger } from '../utils/logger.interface.js';
import { TransientHttpError } from '../utils/infrastructure.js';
import { BaseHtmlParser } from './base.parser.js';
import type { ParsedDocument, ParsedElement } from './parser.interface.js';

/** Rough visible-text length of raw HTML (script/style stripped). */
function visibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

export class StaticHtmlLoader implements PageLoader {
  constructor(
    private readonly userAgent: string,
    private readonly timeoutMs: number,
  ) {}

  async load(request: LoadRequest): Promise<LoadedPage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(request.url, {
        headers: { 'user-agent': this.userAgent, accept: 'text/html' },
        signal: controller.signal,
        redirect: 'follow',
      });
      if (res.status >= 500 || res.status === 429 || res.status === 408) {
        throw new TransientHttpError(res.status, request.url);
      }
      const html = await res.text();
      return {
        requestedUrl: request.url,
        finalUrl: res.url || request.url,
        statusCode: res.status,
        html,
        renderedWith: 'static',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async dispose(): Promise<void> {}
}

export class DynamicBrowserLoader implements PageLoader {
  private browser: unknown;

  constructor(
    private readonly userAgent: string,
    private readonly timeoutMs: number,
    private readonly logger: Logger,
  ) {}

  async load(request: LoadRequest): Promise<LoadedPage> {
    // Imported lazily so the module works even when Playwright browsers
    // aren't installed (static-only runs never reach this path).
    const { chromium } = await import('playwright');
    if (!this.browser) this.browser = await chromium.launch({ headless: true });
    const browser = this.browser as import('playwright').Browser;
    const context = await browser.newContext({ userAgent: this.userAgent });
    const page = await context.newPage();
    try {
      await page.goto(request.url, {
        waitUntil: request.hints.waitUntil ?? 'networkidle',
        timeout: request.hints.timeoutMs ?? this.timeoutMs,
      });
      for (const sel of request.hints.dismissSelectors ?? []) {
        const el = await page.$(sel);
        if (el) await el.click().catch(() => undefined);
      }
      if (request.expandBeforeCapture) {
        // Expansion targets are applied by the caller-provided hints; kept
        // minimal here. Site-specific expansion is declared by the adapter.
      }
      if (request.hints.waitForSelector) {
        await page.waitForSelector(request.hints.waitForSelector, {
          timeout: this.timeoutMs,
        }).catch(() => undefined);
      }
      const html = await page.content();
      return {
        requestedUrl: request.url,
        finalUrl: page.url(),
        html,
        renderedWith: 'dynamic',
      };
    } finally {
      await context.close();
    }
  }

  async dispose(): Promise<void> {
    if (this.browser) {
      await (this.browser as import('playwright').Browser).close();
      this.browser = undefined;
    }
  }
}

export class LoaderRouter implements PageLoader {
  constructor(
    private readonly staticLoader: PageLoader,
    private readonly dynamicLoader: PageLoader,
    private readonly logger: Logger,
    private readonly autoEscalateThreshold = 200,
  ) {}

  async load(request: LoadRequest): Promise<LoadedPage> {
    if (request.mode === 'static') return this.staticLoader.load(request);
    if (request.mode === 'dynamic') return this.dynamicLoader.load(request);

    // auto: prefer static; escalate to the browser only if content looks empty.
    const staticPage = await this.staticLoader.load(request);
    if (visibleTextLength(staticPage.html) >= this.autoEscalateThreshold) {
      return staticPage;
    }
    this.logger.info('loader:auto-escalate', { url: request.url });
    try {
      return await this.dynamicLoader.load({ ...request, mode: 'dynamic' });
    } catch (err) {
      this.logger.warn('loader:dynamic-failed-fallback-static', {
        url: request.url,
        message: err instanceof Error ? err.message : String(err),
      });
      return staticPage;
    }
  }

  async dispose(): Promise<void> {
    await Promise.all([this.staticLoader.dispose(), this.dynamicLoader.dispose()]);
  }
}

/* ------------------------------ Parser --------------------------------- */

class LinkeElement implements ParsedElement {
  // linkedom's element types are structural; `any` keeps the facade decoupled.
  constructor(private readonly el: any) {}

  get tagName(): string {
    return String(this.el.tagName ?? '').toLowerCase();
  }
  text(): string {
    return this.el.textContent ?? '';
  }
  html(): string {
    return this.el.innerHTML ?? '';
  }
  attr(name: string): string | null {
    return this.el.getAttribute ? this.el.getAttribute(name) : null;
  }
  querySelector(selector: string): ParsedElement | null {
    const found = this.el.querySelector?.(selector);
    return found ? new LinkeElement(found) : null;
  }
  querySelectorAll(selector: string): ParsedElement[] {
    const list = this.el.querySelectorAll?.(selector) ?? [];
    return Array.from(list, (e) => new LinkeElement(e));
  }
  children(): ParsedElement[] {
    const kids = this.el.children ?? [];
    return Array.from(kids, (e) => new LinkeElement(e));
  }
}

class LinkeDocument implements ParsedDocument {
  readonly root: ParsedElement;
  constructor(private readonly doc: any, readonly baseUrl: string) {
    this.root = new LinkeElement(doc.body ?? doc.documentElement);
  }
  querySelector(selector: string): ParsedElement | null {
    const found = this.doc.querySelector?.(selector);
    return found ? new LinkeElement(found) : null;
  }
  querySelectorAll(selector: string): ParsedElement[] {
    const list = this.doc.querySelectorAll?.(selector) ?? [];
    return Array.from(list, (e: any) => new LinkeElement(e));
  }
}

export class LinkeDomParser extends BaseHtmlParser {
  parse(html: string, baseUrl: string): ParsedDocument {
    const { document } = parseHTML(html);
    return new LinkeDocument(document, baseUrl);
  }
}
