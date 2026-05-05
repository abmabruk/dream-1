import "server-only";

/**
 * Verify a Vercel Cron request. Returns true if authorized.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 * In dev (no secret), allow if running locally and a dev bypass is set.
 */
export function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Dev convenience: allow if explicit dev bypass set
    return process.env.NODE_ENV !== "production" && process.env.ALLOW_UNAUTH_CRON === "true";
  }
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  // Constant-time comparison
  if (auth.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < auth.length; i++) mismatch |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
