import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws when imported in client code; in vitest (node env) we
// stub it so the module loads cleanly.
vi.mock("server-only", () => ({}));

import { isAuthorizedCron } from "./cron-auth";

const ENV_KEYS = ["CRON_SECRET", "ALLOW_UNAUTH_CRON", "NODE_ENV"] as const;

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/x", { headers });
}

describe("isAuthorizedCron", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete (process.env as Record<string, string | undefined>)[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete (process.env as Record<string, string | undefined>)[key];
      } else {
        (process.env as Record<string, string | undefined>)[key] = originalEnv[key];
      }
    }
  });

  it("returns false in production when no secret is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isAuthorizedCron(makeRequest())).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns true in dev when no secret but ALLOW_UNAUTH_CRON=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.ALLOW_UNAUTH_CRON = "true";
    expect(isAuthorizedCron(makeRequest())).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false in dev when no secret and no bypass", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isAuthorizedCron(makeRequest())).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns true when bearer token matches CRON_SECRET", () => {
    process.env.CRON_SECRET = "s3cret-value";
    const req = makeRequest({ authorization: "Bearer s3cret-value" });
    expect(isAuthorizedCron(req)).toBe(true);
  });

  it("returns false when bearer token does not match", () => {
    process.env.CRON_SECRET = "s3cret-value";
    const req = makeRequest({ authorization: "Bearer wrong-value" });
    expect(isAuthorizedCron(req)).toBe(false);
  });

  it("returns false when bearer token has different length", () => {
    process.env.CRON_SECRET = "s3cret-value";
    const req = makeRequest({ authorization: "Bearer short" });
    expect(isAuthorizedCron(req)).toBe(false);
  });

  it("returns false when authorization header is missing and secret is set", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isAuthorizedCron(makeRequest())).toBe(false);
  });
});
