// Deno runtime (Supabase Edge Functions) — kept as a self-contained twin of
// packages/logger rather than a cross-directory import, since Supabase's
// documented deploy pattern bundles shared edge-function code from
// supabase/functions/_shared, not from outside the functions directory.
// The log SHAPE is the contract that must stay identical across runtimes
// (see packages/logger/src/index.ts) — keep the two in sync by hand.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  event: string;
  userId: string | null;
  context: LogContext | null;
  timestamp: string;
}

export interface LogOptions {
  userId?: string;
  context?: LogContext;
}

function emit(level: LogLevel, event: string, options: LogOptions = {}): LogEntry {
  const entry: LogEntry = {
    level,
    event,
    userId: options.userId ?? null,
    context: options.context ?? null,
    timestamp: new Date().toISOString(),
  };

  console[level](JSON.stringify(entry));

  return entry;
}

export const log = {
  debug: (event: string, options?: LogOptions): LogEntry => emit('debug', event, options),
  info: (event: string, options?: LogOptions): LogEntry => emit('info', event, options),
  warn: (event: string, options?: LogOptions): LogEntry => emit('warn', event, options),
  error: (event: string, options?: LogOptions): LogEntry => emit('error', event, options),
};
