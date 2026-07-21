/**
 * Pipeline stage contract + shared mutable state.
 *
 * The extraction workflow is an ordered list of `PipelineStage`s that each
 * read/advance a `PipelineState`. Stages are SITE-AGNOSTIC — they use the
 * adapter (resolved into `state.adapter`) for any per-site behaviour. This
 * is what keeps the workflow reusable: onboarding a site adds an adapter,
 * not a stage.
 */
import type { CrawlRequest } from '../models/crawl-context.model.js';
import type { SiteAdapter } from '../adapters/adapter.interface.js';
import type { LoadedPage } from '../parsers/page-loader.interface.js';
import type { ParsedDocument } from '../parsers/parser.interface.js';
import type { ContentNode } from '../models/content-node.model.js';
import type { PageMetadata } from '../models/metadata.model.js';
import type { PageAssets, PageDocument } from '../models/page-document.model.js';
import type { CompletenessReport } from '../models/completeness-report.model.js';
import type { ModuleConfig } from '../schemas/config.schema.js';
import type { Logger } from '../utils/logger.interface.js';
import type { PipelineServices } from './services.js';

/** Canonical stage order. Concrete stage classes are implemented in phase 2. */
export const STAGE_ORDER = [
  'discover',
  'load',
  'parse',
  'detect',
  'extract',
  'transform',
  'metadata',
  'assets',
  'validate',
  'enrich',
  'emit',
  'persist',
] as const;
export type StageName = (typeof STAGE_ORDER)[number];

/** Accumulator threaded through the stages (fields filled as they run). */
export interface PipelineState {
  readonly request: CrawlRequest;
  readonly correlationId: string;
  readonly startedAt: string;

  adapter?: SiteAdapter;
  loaded?: LoadedPage;
  parsed?: ParsedDocument;
  /** Primary content root located by the detect stage. */
  contentRoot?: import('../parsers/parser.interface.js').ParsedElement;
  nodes?: ContentNode[];
  /** Blocks removed by the transform stage (feeds the completeness report). */
  duplicatesRemoved?: number;
  metadata?: PageMetadata;
  assets?: PageAssets;
  completeness?: CompletenessReport;
  document?: PageDocument;

  /** Names of stages that executed (becomes provenance). */
  executed: string[];
  /** Non-fatal notes collected during the run. */
  warnings: string[];
}

export interface StageContext {
  readonly logger: Logger;
  readonly config: ModuleConfig;
  readonly services: PipelineServices;
}

export interface PipelineStage {
  readonly name: StageName;
  /** Advance `state`. Throw to abort the run (the orchestrator catches). */
  execute(state: PipelineState, ctx: StageContext): Promise<void>;
}
