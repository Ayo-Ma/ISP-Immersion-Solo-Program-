import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * No-ops (with a console warning) when EXPO_PUBLIC_SENTRY_DSN is unset, so
 * dev/CI environments without a Sentry project don't crash on startup —
 * see docs/SETUP.md for provisioning the real DSN.
 */
export function initSentry(): void {
  if (!dsn) {
    console.warn(
      '[sentry] EXPO_PUBLIC_SENTRY_DSN is not set — error tracking is disabled. See docs/SETUP.md.',
    );
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
