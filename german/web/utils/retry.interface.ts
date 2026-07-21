/**
 * Retry-policy port.
 *
 * Wraps a transient-failure-prone operation with bounded, backed-off
 * retries. Implementation lives outside the core so the strategy (fixed,
 * exponential, jittered) is swappable.
 */
export interface RetryContext {
  readonly attempt: number; // 1-based
  readonly error: unknown;
}

export interface RetryPolicy {
  /** Decide whether an error is transient and worth retrying. */
  isRetryable(error: unknown): boolean;
  /** Milliseconds to wait before the given attempt. */
  backoffFor(attempt: number): number;
  /** Run `op`, retrying per policy; rejects with the last error if exhausted. */
  execute<T>(op: () => Promise<T>, onRetry?: (ctx: RetryContext) => void): Promise<T>;
}
