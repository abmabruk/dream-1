/**
 * Edge-runtime-safe in-memory rate limiter, keyed by an arbitrary string
 * (typically `${path}:${ip}`). Used by `src/middleware.ts` to throttle
 * sensitive endpoints (sign-in, forgot-password) before any handler runs.
 *
 * Tradeoffs:
 *  - In-memory only. Fine for a single Vercel instance / single region.
 *    For multi-region replace `buckets` with Upstash/Redis later.
 *  - Fixed window from first hit (`resetAt`).
 */

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number };

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

// Exported for tests so they can reset state between cases.
export const _buckets = new Map<
  string,
  { count: number; resetAt: number }
>();

export function rateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const bucket = _buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    _buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (bucket.count >= opts.max) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

export function _resetRateLimit(): void {
  _buckets.clear();
}
