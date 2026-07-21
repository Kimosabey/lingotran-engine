import { describe, it } from 'vitest';

/**
 * Orchestrator behaviour to cover in phase 2 (with faked services + stages):
 *  - resolves the adapter for the request URL
 *  - runs stages in STAGE_ORDER and records them in `executed`
 *  - returns ok:false / code "incomplete" when no document is produced
 *  - catches a throwing stage and returns ok:false / code "error"
 *  - runMany aggregates one outcome per request
 */
describe('ExtractionPipeline', () => {
  it.todo('resolves the adapter and runs stages in order');
  it.todo('returns an incomplete outcome when no document is produced');
  it.todo('turns a thrown stage error into a failed outcome');
  it.todo('runMany returns one outcome per request');
});
