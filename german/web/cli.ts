/**
 * CLI entry — discover + extract public pages.
 *
 * Usage (run from german/web):
 *   npx tsx cli.ts https://deutsch-pruefung.de/dtz/lesen/teil1   # explicit URLs
 *   npx tsx cli.ts --exam dtz --limit 5                          # sitemap-discovered
 *   npx tsx cli.ts --all                                         # all public pages
 *
 * Only robots-allowed public pages are ever crawled (the adapter's
 * `shouldCrawl` + the robots gate enforce this).
 */
import { buildPipeline } from './pipelines/composition-root.js';
import type { CrawlRequest } from './models/crawl-context.model.js';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function discoverFromSitemap(sitemapUrl: string, userAgent: string): Promise<string[]> {
  const res = await fetch(sitemapUrl, { headers: { 'user-agent': userAgent } });
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.trim());
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const built = buildPipeline();
  const { pipeline, adapters, logger, config } = built;

  const explicitUrls = args.filter((a) => a.startsWith('http'));
  const examFlag = flag(args, '--exam')?.toLowerCase();
  const limit = Number(flag(args, '--limit') ?? '0');

  let urls: string[];
  if (explicitUrls.length > 0) {
    urls = explicitUrls;
  } else {
    const adapter = adapters.all()[0];
    const sitemap = adapter?.sitemapUrl();
    if (!sitemap) {
      console.error('No explicit URLs and no adapter sitemap; nothing to do.');
      await built.dispose();
      process.exit(1);
    }
    const all = await discoverFromSitemap(sitemap, config.userAgent.value);
    urls = all.filter((u) => {
      try {
        const url = new URL(u);
        if (!adapters.resolve(url).shouldCrawl(url)) return false;
        if (examFlag && !url.pathname.toLowerCase().startsWith(`/${examFlag}`)) return false;
        return true;
      } catch {
        return false;
      }
    });
  }

  if (limit > 0) urls = urls.slice(0, limit);

  logger.info('cli:start', { count: urls.length, examFlag, limit });
  if (urls.length === 0) {
    console.log('No matching public URLs to extract.');
    await built.dispose();
    return;
  }

  const requests: CrawlRequest[] = urls.map((url) => ({ url, depth: 0 }));
  const outcomes = await pipeline.runMany(requests);
  const ok = outcomes.filter((o) => o.ok).length;

  for (const o of outcomes) {
    if (!o.ok) logger.warn('cli:failed', { url: o.url, error: o.error?.message });
  }

  await built.dispose();
  console.log(`\nExtracted ${ok}/${outcomes.length} page(s) → ${config.output.outputDir}`);
  for (const o of outcomes.filter((x) => x.ok)) {
    const c = o.document?.completeness.counts;
    console.log(
      `  ✓ ${o.url}  (h:${c?.headings} p:${c?.paragraphs} l:${c?.lists} t:${c?.tables} img:${c?.images} links:${c?.links})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
