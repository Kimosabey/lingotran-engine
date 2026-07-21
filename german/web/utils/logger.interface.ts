/**
 * Logger port.
 *
 * The pipeline logs every step (mirroring the French workflow's `log(...)`
 * narration). The concrete implementation (e.g. pino) is injected, keeping
 * the core free of a logging-framework dependency.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  trace(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Derive a child logger that stamps every line with `bindings`. */
  child(bindings: Record<string, unknown>): Logger;
}
