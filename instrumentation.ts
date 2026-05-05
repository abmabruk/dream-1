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
  const SECRET_KEYS =
    /^(password|passwordhash|token|tokenhash|authorization|cookie|auth_secret|database_url|secret|portaltoken|recoverycodes|totpsecret)$/i;
  const PII_KEYS = /^(email|phone|mobile|taxnumber|nationalid)$/i;
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const PHONE_RE = /\+?\d[\d\s-]{7,}\d/g;
  const scrubString = (s: string): string =>
    s.replace(EMAIL_RE, "[EMAIL]").replace(PHONE_RE, "[PHONE]");
  const scrub = (obj: unknown): unknown => {
    if (typeof obj === "string") return scrubString(obj);
    if (Array.isArray(obj)) return obj.map(scrub);
    if (obj && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (SECRET_KEYS.test(k)) out[k] = "[REDACTED]";
        else if (PII_KEYS.test(k)) out[k] = "[PII]";
        else out[k] = scrub(v);
      }
      return out;
    }
    return obj;
  };
  return scrub(event) as T;
}

export const onRequestError = Sentry.captureRequestError;
