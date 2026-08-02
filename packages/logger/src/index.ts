/**
 * Structured logging convention, agreed in Phase 0 (MVP Dev Roadmap) so log
 * shape doesn't drift per-developer. Runtime-agnostic (no Node/Deno/RN-only
 * APIs) so the same package works from Expo app code and Supabase Edge
 * Functions.
 */

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

const CONSOLE_METHOD: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

function emit(level: LogLevel, event: string, options: LogOptions = {}): LogEntry {
  const entry: LogEntry = {
    level,
    event,
    userId: options.userId ?? null,
    context: options.context ?? null,
    timestamp: new Date().toISOString(),
  };

  console[CONSOLE_METHOD[level]](JSON.stringify(entry));

  return entry;
}

export const log = {
  debug: (event: string, options?: LogOptions): LogEntry => emit('debug', event, options),
  info: (event: string, options?: LogOptions): LogEntry => emit('info', event, options),
  warn: (event: string, options?: LogOptions): LogEntry => emit('warn', event, options),
  error: (event: string, options?: LogOptions): LogEntry => emit('error', event, options),
};
