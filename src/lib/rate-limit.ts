/**
 * Dream 1 — In-memory sign-in rate limiter.
 *
 * Goal: blunt brute-force / credential-stuffing attempts on the sign-in
 * server action without adding any infra dependency. Keys are lowercased
 * email addresses (the IP is not reliably available inside a server
 * action). Window is rolling from `firstAttempt`: after 5 failed
 * attempts inside 5 minutes the key is locked until the window expires.
 *
 * Notes / tradeoffs:
 *  - Memory only — multi-instance deployments will not share state.
 *    For a single Vercel/Node process this is sufficient as a first
 *    line of defense.
 *  - Successful sign-in clears the bucket so a legitimate user is not
 *    penalized after one fat-finger.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

type Bucket = { count: number; firstAttempt: number };

const buckets = new Map<string, Bucket>();

function normalize(key: string): string {
  return key.trim().toLowerCase();
}

function prune(now: number) {
  for (const [k, b] of buckets) {
    if (now - b.firstAttempt > WINDOW_MS) {
      buckets.delete(k);
    }
  }
}

export function checkSignInRateLimit(
  key: string
): { ok: true } | { ok: false; retryAfterSec: number } {
  const k = normalize(key);
  if (!k) return { ok: true };
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(k);
  if (!bucket) return { ok: true };

  const elapsed = now - bucket.firstAttempt;
  if (elapsed > WINDOW_MS) {
    buckets.delete(k);
    return { ok: true };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((WINDOW_MS - elapsed) / 1000)
    );
    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}

export function recordFailedSignIn(key: string): void {
  const k = normalize(key);
  if (!k) return;
  const now = Date.now();
  const bucket = buckets.get(k);

  if (!bucket || now - bucket.firstAttempt > WINDOW_MS) {
    buckets.set(k, { count: 1, firstAttempt: now });
    return;
  }

  bucket.count += 1;
}

export function clearSignInAttempts(key: string): void {
  const k = normalize(key);
  if (!k) return;
  buckets.delete(k);
}
