import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) {
    // No-op when DSN not configured — safe to ship without setup
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment:
        process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        return scrubEvent(event);
      },
    });
  }
}

function scrubEvent<T>(event: T): T {
  // Recursively redact sensitive fields. Pino redaction handles logs;
  // this catches anything that bubbles up to Sentry.
  const SECRET_KEYS =
    /^(password|passwordhash|token|tokenhash|authorization|cookie|auth_secret|database_url|secret)$/i;
  const scrub = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(scrub);
    if (obj && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        out[k] = SECRET_KEYS.test(k) ? "[REDACTED]" : scrub(v);
      }
      return out;
    }
    return obj;
  };
  return scrub(event) as T;
}

export const onRequestError = Sentry.captureRequestError;
