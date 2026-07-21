/**
 * Concrete pipeline stages.
 *
 * Each stage implements the `PipelineStage` contract, reads/advances the
 * shared `PipelineState`, and delegates to injected services. Stages are
 * SITE-AGNOSTIC — all per-site behaviour comes from `state.adapter`.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { PipelineStage, PipelineState, StageContext } from './stage.interface.js';
import type { ExtractionContext } from '../extractors/content-extractor.interface.js';
import type { SiteAdapter } from '../adapters/adapter.interface.js';
import type { ModuleConfig } from '../schemas/config.schema.js';
import type {
  ContentNode,
  ImageNode,
  MediaNode,
  LinkNode,
} from '../models/content-node.model.js';
import type { PageAssets, Provenance } from '../models/page-document.model.js';
import type { LinkKind, MediaKind } from '../models/enums.js';

const EXTRACTOR_VERSION = '0.1.0';

function makeExtractionContext(
  adapter: SiteAdapter,
  config: ModuleConfig,
  url: URL,
): ExtractionContext {
  const site = adapter.selectorsFor(url);
  return {
    selectors: site,
    ignoreSelectors: [...config.extractionRules.ignoreSelectors, ...site.ignore],
    preserveWhitespace: config.extractionRules.preserveWhitespace,
    minTextLength: config.extractionRules.minTextLength,
    pageUrl: url.href,
  };
}

/** Resolve relative asset URLs on image/figure/media nodes to absolute. */
function resolveNodeUrls(node: ContentNode, resolveUrl: (u: string) => string): ContentNode {
  if (node.type === 'image') return { ...node, src: resolveUrl(node.src) };
  if (node.type === 'media') return { ...node, src: resolveUrl(node.src) };
  if (node.type === 'figure') return { ...node, image: { ...node.image, src: resolveUrl(node.image.src) } };
  return node;
}

function classifyLink(href: string, pageUrl: string): LinkKind {
  if (href.startsWith('#')) return 'anchor';
  if (href.startsWith('mailto:')) return 'mailto';
  try {
    const u = new URL(href, pageUrl);
    if (/\.(pdf|zip|docx?|pptx?|xlsx?|csv|mp3|mp4|wav|epub)$/i.test(u.pathname)) return 'download';
    return u.hostname === new URL(pageUrl).hostname ? 'internal' : 'external';
  } catch {
    return 'external';
  }
}

/* ------------------------------- Stages -------------------------------- */

export class DiscoverStage implements PipelineStage {
  readonly name = 'discover' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const url = new URL(state.request.url);
    const adapter = state.adapter!;
    if (!adapter.shouldCrawl(url)) {
      throw new Error(`adapter '${adapter.id}' declined to crawl ${url.href}`);
    }
    if (ctx.config.userAgent.respectRobots) {
      const allowed = await ctx.services.robots.isAllowed(url.href, ctx.config.userAgent.value);
      if (!allowed) throw new Error(`robots.txt disallows ${url.href}`);
    }
  }
}

export class LoadStage implements PipelineStage {
  readonly name = 'load' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const url = new URL(state.request.url);
    const adapter = state.adapter!;
    const release = await ctx.services.rateLimiter.acquire(url.hostname);
    try {
      state.loaded = await ctx.services.retry.execute(
        () =>
          ctx.services.loader.load({
            url: url.href,
            mode: adapter.capabilities.renderMode,
            hints: adapter.renderHints(url),
            expandBeforeCapture: adapter.expansionTargets(url).length > 0,
          }),
        (c) => ctx.logger.warn('load:retry', { attempt: c.attempt }),
      );
    } finally {
      release();
    }
  }
}

export class ParseStage implements PipelineStage {
  readonly name = 'parse' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const loaded = state.loaded!;
    state.parsed = ctx.services.parser.parse(loaded.html, loaded.finalUrl);
  }
}

export class DetectStage implements PipelineStage {
  readonly name = 'detect' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const url = new URL(state.request.url);
    const ectx = makeExtractionContext(state.adapter!, ctx.config, url);
    state.contentRoot = ctx.services.detector.detect(state.parsed!, ectx) ?? undefined;
  }
}

export class ExtractStage implements PipelineStage {
  readonly name = 'extract' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const url = new URL(state.request.url);
    const ectx = makeExtractionContext(state.adapter!, ctx.config, url);
    const root = state.contentRoot ?? state.parsed!.root;
    const pageUrl = state.loaded!.finalUrl;
    const nodes = ctx.services.contentExtractor.extract(root, ectx);
    state.nodes = nodes.map((n) => resolveNodeUrls(n, (u) => ctx.services.assetManager.resolveUrl(u, pageUrl)));
  }
}

export class TransformStage implements PipelineStage {
  readonly name = 'transform' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const result = ctx.services.transformer.transform(state.nodes ?? [], {
      dedupe: ctx.config.extractionRules.dedupe,
      preserveWhitespace: ctx.config.extractionRules.preserveWhitespace,
      normalizeUnicode: true,
    });
    state.nodes = result.nodes;
    state.duplicatesRemoved = result.duplicatesRemoved;
  }
}

export class MetadataStage implements PipelineStage {
  readonly name = 'metadata' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const url = new URL(state.request.url);
    const adapter = state.adapter!;
    const titleEl = state.parsed!.querySelector('title');
    const classification = adapter.classify(url, { title: titleEl?.text() });
    state.metadata = ctx.services.metadataExtractor.extract(
      state.parsed!,
      url,
      classification,
      adapter.slugFor(url),
    );
  }
}

export class AssetsStage implements PipelineStage {
  readonly name = 'assets' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const root = state.contentRoot ?? state.parsed!.root;
    const pageUrl = state.loaded!.finalUrl;
    const resolveUrl = (u: string): string => ctx.services.assetManager.resolveUrl(u, pageUrl);
    let seq = 0;
    const id = (p: string): string => `${p}${(seq += 1)}`;

    const images: ImageNode[] = root
      .querySelectorAll('img')
      .map((el, i): ImageNode => ({
        id: id('img'), type: 'image', order: i,
        src: resolveUrl(el.attr('src') ?? el.attr('data-src') ?? ''),
        alt: el.attr('alt') ?? '',
      }))
      .filter((n) => n.src.length > 0);

    const mediaTags: Record<string, MediaKind> = { audio: 'audio', video: 'video', iframe: 'iframe' };
    const media: MediaNode[] = root
      .querySelectorAll('audio, video, iframe')
      .map((el, i): MediaNode => ({
        id: id('med'), type: 'media', order: i,
        kind: mediaTags[el.tagName] ?? 'embed',
        src: resolveUrl(el.attr('src') ?? el.querySelector('source')?.attr('src') ?? ''),
      }))
      .filter((n) => n.src.length > 0);

    const links: LinkNode[] = root
      .querySelectorAll('a[href]')
      .map((el, i): LinkNode => {
        const href = el.attr('href') ?? '';
        return {
          id: id('lnk'), type: 'link', order: i,
          href: resolveUrl(href),
          text: el.text().replace(/\s+/g, ' ').trim(),
          kind: classifyLink(href, pageUrl),
        };
      })
      .filter((n) => n.href.length > 0);

    const assets: PageAssets = { images, media, links };
    state.assets = assets;
  }
}

export class ValidateStage implements PipelineStage {
  readonly name = 'validate' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    state.completeness = ctx.services.completenessValidator.evaluate({
      nodes: state.nodes ?? [],
      assets: state.assets ?? { images: [], media: [], links: [] },
      duplicatesRemoved: state.duplicatesRemoved ?? 0,
      retries: 0,
    });
    for (const w of state.completeness.warnings) state.warnings.push(w);
  }
}

export class EmitStage implements PipelineStage {
  readonly name = 'emit' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    const adapter = state.adapter!;
    const provenance: Provenance = {
      adapterId: adapter.id,
      extractorVersion: EXTRACTOR_VERSION,
      stages: [...state.executed, this.name],
    };
    const doc = ctx.services.assembler.assemble({
      metadata: state.metadata!,
      nodes: state.nodes ?? [],
      assets: state.assets ?? { images: [], media: [], links: [] },
      completeness: state.completeness!,
      provenance,
    });

    const check = ctx.services.schemaValidator.validate(doc);
    if (!check.ok) ctx.logger.warn('emit:schema-invalid', { issues: check.issues.slice(0, 3) });

    const outDir = resolve(process.cwd(), ctx.config.output.outputDir);
    const pagesDir = join(outDir, adapter.id, 'pages');
    const qaDir = join(pagesDir, '_qa');
    const slug = doc.metadata.slug;

    if (ctx.config.output.emitMarkdown) {
      await mkdir(pagesDir, { recursive: true });
      await writeFile(join(pagesDir, `${slug}.md`), ctx.services.markdownSerializer.serialize(doc), 'utf8');
    }
    if (ctx.config.output.emitJson) {
      await mkdir(pagesDir, { recursive: true });
      await writeFile(join(pagesDir, `${slug}.json`), ctx.services.jsonSerializer.serialize(doc), 'utf8');
      await mkdir(qaDir, { recursive: true });
      await writeFile(join(qaDir, `${slug}.json`), JSON.stringify(doc.completeness, null, 2), 'utf8');
    }

    ctx.logger.info('emit:written', { slug, status: doc.status, qa: doc.qa });
    state.document = doc;
  }
}

export class PersistStage implements PipelineStage {
  readonly name = 'persist' as const;
  async execute(state: PipelineState, ctx: StageContext): Promise<void> {
    if (!ctx.config.output.updateManifest || !state.document) return;
    const doc = state.document;
    const contentHash = createHash('sha256')
      .update(JSON.stringify(doc.nodes))
      .digest('hex')
      .slice(0, 16);
    await ctx.services.stateStore.set({
      slug: doc.metadata.slug,
      sourceUrl: doc.metadata.sourceUrl,
      status: doc.status,
      qa: doc.qa,
      contentHash,
      updatedAt: new Date().toISOString(),
    });
  }
}

/** The canonical, ordered stage list the orchestrator runs. */
export function defaultStages(): PipelineStage[] {
  return [
    new DiscoverStage(),
    new LoadStage(),
    new ParseStage(),
    new DetectStage(),
    new ExtractStage(),
    new TransformStage(),
    new MetadataStage(),
    new AssetsStage(),
    new ValidateStage(),
    new EmitStage(),
    new PersistStage(),
  ];
}
