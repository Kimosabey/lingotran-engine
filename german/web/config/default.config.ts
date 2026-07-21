/**
 * Engine-wide default configuration.
 *
 * `defaultConfig` are the safe, polite defaults. `loadConfig` overlays
 * environment variables (see `.env.example`) and validates the result
 * through `moduleConfigSchema`. NO website-specific values live here — those
 * belong to adapters.
 */
import { moduleConfigSchema, type ModuleConfig } from '../schemas/config.schema.js';

export const defaultConfig: ModuleConfig = moduleConfigSchema.parse({
  rateLimit: {},
  retry: {},
  userAgent: {
    value: 'LingotranBot/0.1 (+authorized-crawl)',
    respectRobots: true,
  },
  extractionRules: {},
  output: {},
  logging: {},
  enrichment: {},
});

/**
 * Build a validated config from process.env, falling back to defaults.
 * Pure/deterministic — reads env only. (No scraping behaviour.)
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ModuleConfig {
  const num = (v: string | undefined, d: number): number =>
    v === undefined || v === '' ? d : Number(v);
  const bool = (v: string | undefined, d: boolean): boolean =>
    v === undefined || v === '' ? d : v.toLowerCase() === 'true';

  return moduleConfigSchema.parse({
    rateLimit: {
      requestDelayMs: num(env.REQUEST_DELAY_MS, defaultConfig.rateLimit.requestDelayMs),
      maxConcurrency: num(env.MAX_CONCURRENCY, defaultConfig.rateLimit.maxConcurrency),
      timeoutMs: num(env.NAV_TIMEOUT_MS, defaultConfig.rateLimit.timeoutMs),
    },
    retry: {
      maxRetries: num(env.MAX_RETRIES, defaultConfig.retry.maxRetries),
      backoffMs: num(env.RETRY_BACKOFF_MS, defaultConfig.retry.backoffMs),
    },
    userAgent: {
      value: env.WEB_EXTRACTOR_USER_AGENT ?? defaultConfig.userAgent.value,
      respectRobots: bool(env.RESPECT_ROBOTS, true),
    },
    extractionRules: {},
    output: {
      outputDir: env.OUTPUT_DIR ?? defaultConfig.output.outputDir,
      emitJson: bool(env.EMIT_JSON, defaultConfig.output.emitJson),
      emitMarkdown: bool(env.EMIT_MARKDOWN, defaultConfig.output.emitMarkdown),
    },
    logging: {
      level: (env.LOG_LEVEL as ModuleConfig['logging']['level']) ?? defaultConfig.logging.level,
      pretty: bool(env.LOG_PRETTY, defaultConfig.logging.pretty),
    },
    enrichment: {
      enabled: bool(env.ENRICHMENT_ENABLED, false),
      ...(env.ENRICHMENT_MODEL ? { model: env.ENRICHMENT_MODEL } : {}),
    },
  });
}
