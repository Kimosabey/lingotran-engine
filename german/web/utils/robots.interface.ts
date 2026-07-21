/**
 * robots.txt policy port.
 *
 * The pipeline consults this before fetching ANY url. Honouring robots.txt
 * is mandatory (see the module README's authorization note); disabling it
 * requires explicit written authorization and is a config/adapter concern,
 * never a silent default.
 */
export interface RobotsPolicy {
  /** True if `userAgent` is allowed to fetch `url` per the host's robots.txt. */
  isAllowed(url: string, userAgent: string): Promise<boolean>;
  /** Crawl-delay (ms) the host requests for `userAgent`, if any. */
  crawlDelay(url: string, userAgent: string): Promise<number | undefined>;
  /** Sitemap URLs advertised in robots.txt. */
  sitemaps(url: string): Promise<string[]>;
}
