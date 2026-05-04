/**
 * Lightweight CSRF defense for Edge middleware.
 *
 * For unsafe HTTP methods (POST/PUT/PATCH/DELETE) we require that the
 * request's `Origin` (or, falling back, `Referer`) header matches the
 * `Host` we received. Browsers always set `Origin` on cross-site
 * fetch/XHR/form POSTs, so a mismatch is a strong signal of a CSRF
 * attempt and we reject it before the route handler runs.
 *
 * Returns `true` when the request looks cross-origin and should be
 * blocked. A missing Host (which should not happen behind any sane
 * proxy) is treated as cross-origin for safety.
 */
export function isCrossOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const referer = headers.get("referer");
  const host = headers.get("host");

  if (!host) return true;

  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host === host) return false;
    } catch {
      // fall through to cross-origin
    }
    return true;
  }

  if (referer) {
    try {
      const r = new URL(referer);
      if (r.host === host) return false;
    } catch {
      // fall through to cross-origin
    }
    return true;
  }

  // Neither Origin nor Referer present: treat as cross-origin.
  return true;
}
