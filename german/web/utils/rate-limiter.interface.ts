/**
 * Rate-limiter / concurrency-gate port.
 *
 * Enforces per-host politeness: a minimum delay between requests and a cap
 * on simultaneous in-flight requests. Keeps the crawler well-behaved and
 * within any agreed crawl budget.
 */
export interface RateLimiter {
  /**
   * Acquire a slot for `host`, resolving once it is polite to proceed.
   * Returns a release function to call when the request completes.
   */
  acquire(host: string): Promise<() => void>;
}
