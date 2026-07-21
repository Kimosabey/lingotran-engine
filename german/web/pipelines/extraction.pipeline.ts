/**
 * Extraction pipeline orchestrator.
 *
 * A generic, site-agnostic runner: it resolves the adapter for a URL, then
 * executes an injected, ordered list of `PipelineStage`s over a shared
 * `PipelineState`, logging each step and turning the result (or any thrown
 * error) into a `CrawlOutcome`. It contains NO extraction logic — that lives
 * in the stage implementations injected at composition time (phase 2).
 *
 * Because the stage list and adapter are injected, onboarding a new website
 * never requires changing this class (Open/Closed).
 */
import type { CrawlRequest, CrawlOutcome } from '../models/crawl-context.model.js';
import type { ExtractionPipelinePort } from './pipeline.interface.js';
import type {
  PipelineStage,
  PipelineState,
  StageContext,
} from './stage.interface.js';

export class ExtractionPipeline implements ExtractionPipelinePort {
  constructor(
    private readonly stages: PipelineStage[],
    private readonly ctx: StageContext,
  ) {}

  async run(request: CrawlRequest): Promise<CrawlOutcome> {
    const startedAt = new Date().toISOString();
    const state: PipelineState = {
      request,
      startedAt,
      correlationId: `${request.url}@${startedAt}`,
      executed: [],
      warnings: [],
    };

    const log = this.ctx.logger.child({ url: request.url, cid: state.correlationId });
    const begin = Date.now();

    try {
      state.adapter = this.ctx.services.adapters.resolve(new URL(request.url));
      log.info('pipeline:start', { adapter: state.adapter.id });

      for (const stage of this.stages) {
        log.info('stage:start', { stage: stage.name });
        await stage.execute(state, this.ctx);
        state.executed.push(stage.name);
        log.debug('stage:done', { stage: stage.name });
      }

      const durationMs = Date.now() - begin;
      if (!state.document) {
        log.warn('pipeline:incomplete', { reason: 'no document produced' });
        return {
          url: request.url,
          ok: false,
          error: { code: 'incomplete', message: 'pipeline produced no document' },
          attempts: 1,
          durationMs,
        };
      }

      log.info('pipeline:done', { durationMs, stages: state.executed.length });
      return {
        url: request.url,
        ok: true,
        document: state.document,
        attempts: 1,
        durationMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('pipeline:error', { message });
      return {
        url: request.url,
        ok: false,
        error: { code: 'error', message },
        attempts: 1,
        durationMs: Date.now() - begin,
      };
    }
  }

  /**
   * Extract many pages. Sequential by default; genuine concurrency is
   * enforced by the injected RateLimiter at the load stage. (A p-limit-based
   * fan-out can be layered here in phase 2 without changing callers.)
   */
  async runMany(requests: CrawlRequest[]): Promise<CrawlOutcome[]> {
    const outcomes: CrawlOutcome[] = [];
    for (const request of requests) {
      outcomes.push(await this.run(request));
    }
    return outcomes;
  }
}
