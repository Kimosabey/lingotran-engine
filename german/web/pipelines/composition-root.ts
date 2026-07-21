/**
 * Composition root — the ONE place concretions are wired to ports.
 *
 * Everything above this file depends only on interfaces. Swapping an
 * implementation (parser, loader, logger) or adding a site adapter happens
 * here; no core code changes.
 */
import { resolve } from 'node:path';
import { loadConfig } from '../config/default.config.js';
import {
  PinoLogger,
  HttpRobotsPolicy,
  SimpleRateLimiter,
  ExponentialRetryPolicy,
} from '../utils/infrastructure.js';
import { AssetManagerImpl, ManifestStateStore } from '../utils/storage.js';
import {
  StaticHtmlLoader,
  DynamicBrowserLoader,
  LoaderRouter,
  LinkeDomParser,
} from '../parsers/implementations.js';
import {
  HeuristicContentDetector,
  DomContentExtractor,
  MetadataExtractorImpl,
} from '../extractors/implementations.js';
import { defaultNodeRegistry } from '../extractors/node-extractors.js';
import {
  ContentTransformerImpl,
  DocumentAssemblerImpl,
  MarkdownSerializerImpl,
  JsonSerializerImpl,
} from '../transformers/implementations.js';
import { CompletenessValidatorImpl } from '../validators/implementations.js';
import { SchemaValidator } from '../validators/schema.validator.js';
import { AdapterRegistry } from '../adapters/adapter.registry.js';
import { GenericAdapter } from '../adapters/generic.adapter.js';
import { DeutschPruefungAdapter } from '../adapters/deutsch-pruefung.adapter.js';
import type { PipelineServices } from './services.js';
import type { StageContext } from './stage.interface.js';
import { ExtractionPipeline } from './extraction.pipeline.js';
import { defaultStages } from './stages.js';

export interface BuiltPipeline {
  readonly pipeline: ExtractionPipeline;
  readonly adapters: AdapterRegistry;
  readonly logger: PinoLogger;
  readonly config: ReturnType<typeof loadConfig>;
  dispose(): Promise<void>;
}

export function buildPipeline(): BuiltPipeline {
  const config = loadConfig();
  const logger = PinoLogger.create(config.logging.level, config.logging.pretty);

  const staticLoader = new StaticHtmlLoader(config.userAgent.value, config.rateLimit.timeoutMs);
  const dynamicLoader = new DynamicBrowserLoader(config.userAgent.value, config.rateLimit.timeoutMs, logger);
  const loader = new LoaderRouter(staticLoader, dynamicLoader, logger);

  const adapters = new AdapterRegistry(new GenericAdapter()).register(new DeutschPruefungAdapter());

  const services: PipelineServices = {
    adapters,
    loader,
    parser: new LinkeDomParser(),
    detector: new HeuristicContentDetector(),
    contentExtractor: new DomContentExtractor(defaultNodeRegistry()),
    metadataExtractor: new MetadataExtractorImpl(),
    transformer: new ContentTransformerImpl(),
    assembler: new DocumentAssemblerImpl(),
    completenessValidator: new CompletenessValidatorImpl(),
    schemaValidator: new SchemaValidator(),
    markdownSerializer: new MarkdownSerializerImpl(),
    jsonSerializer: new JsonSerializerImpl(),
    assetManager: new AssetManagerImpl(),
    stateStore: new ManifestStateStore(resolve(process.cwd(), config.output.outputDir, 'manifest.tsv')),
    robots: new HttpRobotsPolicy(config.userAgent.value),
    rateLimiter: new SimpleRateLimiter(config.rateLimit.requestDelayMs, config.rateLimit.maxConcurrency),
    retry: new ExponentialRetryPolicy(
      config.retry.maxRetries,
      config.retry.backoffMs,
      config.retry.backoffFactor,
      config.retry.retryableStatusCodes,
    ),
    logger,
  };

  const ctx: StageContext = { logger, config, services };
  const pipeline = new ExtractionPipeline(defaultStages(), ctx);

  return {
    pipeline,
    adapters,
    logger,
    config,
    dispose: () => loader.dispose(),
  };
}
