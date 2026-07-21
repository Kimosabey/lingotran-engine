/**
 * Pipeline dependency bundle (the composition contract).
 *
 * Every collaborator the pipeline needs is an injected PORT — the pipeline
 * depends on abstractions, never concretions (Dependency Inversion). The
 * composition root builds these once and hands them to the orchestrator.
 * Adding a website adds an adapter to `adapters`; nothing else here changes.
 */
import type { AdapterRegistry } from '../adapters/adapter.registry.js';
import type { PageLoader } from '../parsers/page-loader.interface.js';
import type { HtmlParser } from '../parsers/parser.interface.js';
import type {
  ContentDetector,
  ContentExtractor,
} from '../extractors/content-extractor.interface.js';
import type { MetadataExtractor } from '../extractors/metadata-extractor.interface.js';
import type {
  ContentTransformer,
  DocumentAssembler,
} from '../transformers/transformer.interface.js';
import type {
  MarkdownSerializer,
  JsonSerializer,
} from '../transformers/serializer.interface.js';
import type { CompletenessValidator } from '../validators/completeness.validator.js';
import type { Validator } from '../validators/validator.interface.js';
import type {
  Logger,
  RobotsPolicy,
  RateLimiter,
  RetryPolicy,
  AssetManager,
  StateStore,
  CredentialProvider,
} from '../utils/index.js';
import type { PageDocument } from '../models/page-document.model.js';

/**
 * Optional AI-enrichment port (future). A no-op unless enabled — the
 * deterministic pipeline is fully functional without it.
 */
export interface ContentEnricher {
  enrich(doc: PageDocument): Promise<PageDocument>;
}

export interface PipelineServices {
  readonly adapters: AdapterRegistry;
  readonly loader: PageLoader;
  readonly parser: HtmlParser;
  readonly detector: ContentDetector;
  readonly contentExtractor: ContentExtractor;
  readonly metadataExtractor: MetadataExtractor;
  readonly transformer: ContentTransformer;
  readonly assembler: DocumentAssembler;
  readonly completenessValidator: CompletenessValidator;
  readonly schemaValidator: Validator<unknown>;
  readonly markdownSerializer: MarkdownSerializer;
  readonly jsonSerializer: JsonSerializer;
  readonly assetManager: AssetManager;
  readonly stateStore: StateStore;
  readonly robots: RobotsPolicy;
  readonly rateLimiter: RateLimiter;
  readonly retry: RetryPolicy;
  /** Present only when authenticated crawling is authorized + configured. */
  readonly credentials?: CredentialProvider;
  /** Present only when AI enrichment is enabled. */
  readonly enricher?: ContentEnricher;
  readonly logger: Logger;
}
