import "server-only";
import pino from "pino";

/**
 * Structured logger.
 *
 * - Dev: pretty-printed via pino-pretty (only loaded in non-prod).
 * - Prod: JSON to stdout (Vercel collects automatically).
 * - LOG_LEVEL env: trace/debug/info/warn/error/fatal (default info).
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId, factoryId, action }, "human message");
 *   const child = logger.child({ requestId });
 */

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");

// Redact common secrets/PII keys from logs at every level
const redact = {
  paths: [
    "password",
    "passwordHash",
    "token",
    "tokenHash",
    "authorization",
    "auth",
    "*.password",
    "*.passwordHash",
    "*.token",
    "*.tokenHash",
    "*.authorization",
    "*.auth",
    "headers.authorization",
    "headers.cookie",
    "req.headers.authorization",
    "req.headers.cookie",
  ],
  censor: "[REDACTED]",
};

function buildLogger() {
  try {
    return pino({
      level,
      redact,
      base: { env: process.env.NODE_ENV ?? "development" },
      // Pretty print only in dev
      ...(isProd
        ? {}
        : {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss.l",
                singleLine: false,
                ignore: "pid,hostname",
              },
            },
          }),
    });
  } catch {
    // Fallback: plain pino without transport (e.g. if pino-pretty fails to load)
    return pino({
      level,
      redact,
      base: { env: process.env.NODE_ENV ?? "development" },
    });
  }
}

export const logger = buildLogger();

/** Generate a short request correlation id. */
export function newRequestId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

/** Build a child logger for a request, includes correlation id + path. */
export function requestLogger(req: Request, opts: { requestId?: string } = {}) {
  const requestId =
    opts.requestId ?? req.headers.get("x-request-id") ?? newRequestId();
  let path = "";
  let method = "";
  try {
    const url = new URL(req.url);
    path = url.pathname;
    method = req.method;
  } catch {
    // ignore URL parse failure; child still gets requestId
  }
  return logger.child({ requestId, method, path });
}
