// Deno runtime (Supabase Edge Functions). No-ops when SENTRY_DSN_EDGE isn't
// set, same guard rail as apps/mobile/lib/sentry.ts, so functions still run
// locally/in CI without a provisioned Sentry project.
// Set the secret with: supabase secrets set SENTRY_DSN_EDGE=<dsn>

import * as Sentry from 'npm:@sentry/deno@^7.120.3';

let initialized = false;

export function initSentry(): void {
  const dsn = Deno.env.get('SENTRY_DSN_EDGE');

  if (!dsn) {
    console.warn(
      '[sentry] SENTRY_DSN_EDGE is not set — error tracking is disabled for this function. See docs/SETUP.md.',
    );
    return;
  }

  Sentry.init({ dsn, tracesSampleRate: 1.0 });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    console.error('[unreported to sentry]', error, context ?? {});
    return;
  }

  Sentry.captureException(error, context ? { extra: context } : undefined);
}
