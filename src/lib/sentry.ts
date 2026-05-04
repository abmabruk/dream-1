import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Capture an exception with optional context. No-op when DSN unset.
 * Use this when handling errors in services / cron jobs that bypass
 * the route error handler.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  try {
    if (context) {
      Sentry.withScope((scope) => {
        for (const [k, v] of Object.entries(context)) {
          scope.setExtra(k, v);
        }
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch {
    // Sentry must never break the app
  }
}
