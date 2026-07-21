/**
 * Barrel for configuration.
 *
 * `defaultConfig` / `loadConfig` — engine-wide defaults (rate limit, retry,
 * user agent, extraction rules, output). `websitesConfig` — which sites are
 * enabled (no selectors). Per-site behaviour lives in adapters, not here.
 */
export * from './default.config.js';
export * from './websites.config.js';
