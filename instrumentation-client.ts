import * as Sentry from "@sentry/nextjs";

const SECRET_KEYS =
  /^(password|passwordhash|token|tokenhash|authorization|cookie|auth_secret|database_url|secret|portaltoken|recoverycodes|totpsecret)$/i;
const PII_KEYS = /^(email|phone|mobile|taxnumber|nationalid)$/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s-]{7,}\d/g;

function scrubString(s: string): string {
  return s.replace(EMAIL_RE, "[EMAIL]").replace(PHONE_RE, "[PHONE]");
}

function scrub<T>(obj: T): T {
  if (typeof obj === "string") return scrubString(obj) as T;
  if (Array.isArray(obj)) return obj.map(scrub) as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SECRET_KEYS.test(k)) out[k] = "[REDACTED]";
      else if (PII_KEYS.test(k)) out[k] = "[PII]";
      else out[k] = scrub(v);
    }
    return out as T;
  }
  return obj;
}

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      return scrub(event);
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
