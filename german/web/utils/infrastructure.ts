/**
 * Concrete implementations of the cross-cutting infrastructure ports.
 *
 * These are the injectable "driven adapters" (pino logger, robots.txt policy,
 * per-host rate limiter, exponential retry). They contain no extraction or
 * site-specific logic.
 */
import pino from 'pino';
import robotsParser from 'robots-parser';
import type { Logger } from './logger.interface.js';
import type { RobotsPolicy } from './robots.interface.js';
import type { RateLimiter } from './rate-limiter.interface.js';
import type { RetryPolicy, RetryContext } from './retry.interface.js';

/* ------------------------------- Logger -------------------------------- */

export class PinoLogger implements Logger {
  constructor(private readonly p: pino.Logger) {}

  static create(level = 'info', _pretty = true): PinoLogger {
    // Structured JSON logs (pino-pretty is intentionally not a dependency).
    return new PinoLogger(pino({ level }));
  }

  trace(msg: string, fields?: Record<string, unknown>): void { this.p.trace(fields ?? {}, msg); }
  debug(msg: string, fields?: Record<string, unknown>): void { this.p.debug(fields ?? {}, msg); }
  info(msg: string, fields?: Record<string, unknown>): void { this.p.info(fields ?? {}, msg); }
  warn(msg: string, fields?: Record<string, unknown>): void { this.p.warn(fields ?? {}, msg); }
  error(msg: string, fields?: Record<string, unknown>): void { this.p.error(fields ?? {}, msg); }
  child(bindings: Record<string, unknown>): Logger { return new PinoLogger(this.p.child(bindings)); }
}

/* ---------------------------- Robots policy ---------------------------- */

export class HttpRobotsPolicy implements RobotsPolicy {
  private readonly cache = new Map<string, ReturnType<typeof robotsParser>>();

  constructor(private readonly userAgent: string) {}

  private async robotsFor(url: string): Promise<ReturnType<typeof robotsParser>> {
    const origin = new URL(url).origin;
    const cached = this.cache.get(origin);
    if (cached) return cached;
    const robotsUrl = `${origin}/robots.txt`;
    let body = '';
    try {
      const res = await fetch(robotsUrl, { headers: { 'user-agent': this.userAgent } });
      body = res.ok ? await res.text() : '';
    } catch {
      body = '';
    }
    const parser = robotsParser(robotsUrl, body);
    this.cache.set(origin, parser);
    return parser;
  }

  async isAllowed(url: string, userAgent: string): Promise<boolean> {
    const parser = await this.robotsFor(url);
    // Default-allow only when robots.txt is absent/empty (isAllowed → undefined).
    return parser.isAllowed(url, userAgent) ?? true;
  }

  async crawlDelay(url: string, userAgent: string): Promise<number | undefined> {
    const parser = await this.robotsFor(url);
    const delay = parser.getCrawlDelay(userAgent);
    return delay === undefined ? undefined : delay * 1000;
  }

  async sitemaps(url: string): Promise<string[]> {
    const parser = await this.robotsFor(url);
    return parser.getSitemaps();
  }
}

/* ---------------------------- Rate limiter ----------------------------- */

/** Per-host minimum-delay gate with a global concurrency cap. */
export class SimpleRateLimiter implements RateLimiter {
  private readonly lastStart = new Map<string, number>();
  private active = 0;

  constructor(
    private readonly minDelayMs: number,
    private readonly maxConcurrency: number,
  ) {}

  async acquire(host: string): Promise<() => void> {
    while (this.active >= this.maxConcurrency) {
      await this.sleep(50);
    }
    const last = this.lastStart.get(host) ?? 0;
    const wait = Math.max(0, this.minDelayMs - (Date.now() - last));
    if (wait > 0) await this.sleep(wait);
    this.lastStart.set(host, Date.now());
    this.active += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active -= 1;
      }
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/* ------------------------------- Retry --------------------------------- */

export class ExponentialRetryPolicy implements RetryPolicy {
  constructor(
    private readonly maxRetries: number,
    private readonly baseBackoffMs: number,
    private readonly factor: number,
    private readonly retryableStatusCodes: number[],
  ) {}

  isRetryable(error: unknown): boolean {
    if (error instanceof TransientHttpError) {
      return this.retryableStatusCodes.includes(error.status);
    }
    // Network-level failures (DNS, reset, timeout) are transient.
    return error instanceof Error;
  }

  backoffFor(attempt: number): number {
    return Math.round(this.baseBackoffMs * this.factor ** (attempt - 1));
  }

  async execute<T>(op: () => Promise<T>, onRetry?: (ctx: RetryContext) => void): Promise<T> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        return await op();
      } catch (error) {
        if (attempt > this.maxRetries || !this.isRetryable(error)) throw error;
        onRetry?.({ attempt, error });
        await new Promise((r) => setTimeout(r, this.backoffFor(attempt)));
      }
    }
  }
}

/** Marker error for retryable HTTP responses. */
export class TransientHttpError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`Transient HTTP ${status} for ${url}`);
    this.name = 'TransientHttpError';
  }
}
