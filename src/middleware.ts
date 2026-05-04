import { NextRequest, NextResponse } from "next/server";

import { isCrossOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";

// ── Configuration ───────────────────────────────────────────────
const RATE_LIMIT_PATHS = new Set<string>([
  "/api/v1/session",
  "/api/v1/auth/forgot-password",
]);
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PORTAL_PREFIX = "/portal/";

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  // HSTS — only effective on https in prod, harmless in dev.
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  // CSP — strict-ish; allow Next inline runtime + same-origin.
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // 1. Rate limit sign-in / forgot-password (POST only)
  if (RATE_LIMIT_PATHS.has(pathname) && method === "POST") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const result = rateLimit(`${pathname}:${ip}`, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { message: "Too many requests, try later." } },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfter) },
        },
      );
    }
  }

  // 2. CSRF: deny unsafe cross-origin requests, except portal endpoints
  //    (customer-facing, called from arbitrary email clients / browsers).
  if (UNSAFE_METHODS.has(method) && !pathname.startsWith(PORTAL_PREFIX)) {
    if (isCrossOrigin(req.headers)) {
      return NextResponse.json(
        { ok: false, error: { message: "Cross-origin request denied." } },
        { status: 403 },
      );
    }
  }

  // 3. Security headers on every response.
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Apply to all routes except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map)).*)",
  ],
};
