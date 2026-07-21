/**
 * Barrel for the orchestration layer.
 *
 * `ExtractionPipeline` is the reusable workflow; `PipelineServices` is the
 * DI contract; `PipelineStage` / `STAGE_ORDER` define the canonical stage
 * sequence that concrete stages (phase 2) plug into.
 */
export * from './services.js';
export * from './stage.interface.js';
export * from './pipeline.interface.js';
export * from './extraction.pipeline.js';
