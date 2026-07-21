/**
 * Page-loader port — turns a URL into raw HTML, choosing the right strategy.
 *
 * Two concrete strategies satisfy this port (implemented in phase 2):
 *   - StaticHtmlLoader   : plain HTTP fetch of server-rendered HTML (cheap).
 *   - DynamicBrowserLoader: Playwright render for client-rendered/Next.js/SPA.
 * The `auto` mode tries static first and escalates to dynamic when the
 * static HTML yields no meaningful content. The adapter's `renderMode`
 * capability decides which is used.
 */
import type { RenderMode } from '../models/enums.js';
import type { RenderHints } from '../adapters/adapter.interface.js';

export interface LoadedPage {
  readonly requestedUrl: string;
  /** URL after redirects. */
  readonly finalUrl: string;
  readonly statusCode?: number;
  /** Fully-rendered HTML ready for parsing. */
  readonly html: string;
  /** Which strategy actually produced this HTML. */
  readonly renderedWith: Exclude<RenderMode, 'auto'>;
}

export interface LoadRequest {
  readonly url: string;
  readonly mode: RenderMode;
  readonly hints: RenderHints;
  /** Expansion is applied by the dynamic loader; static ignores it. */
  readonly expandBeforeCapture?: boolean;
}

export interface PageLoader {
  load(request: LoadRequest): Promise<LoadedPage>;
  /** Release any held resources (e.g. close the browser). */
  dispose(): Promise<void>;
}
