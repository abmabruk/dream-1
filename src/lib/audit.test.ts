import { describe, expect, it } from "vitest";

import { auditContextFromRequest } from "./audit";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/test", { headers });
}

describe("auditContextFromRequest", () => {
  it("returns nulls when no relevant headers are present", () => {
    const ctx = auditContextFromRequest(makeRequest({}));
    expect(ctx).toEqual({
      ipAddress: null,
      userAgent: null,
      requestId: null,
    });
  });

  it("extracts the first IP from x-forwarded-for", () => {
    const ctx = auditContextFromRequest(
      makeRequest({
        "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178",
      }),
    );
    expect(ctx.ipAddress).toBe("203.0.113.5");
  });

  it("trims whitespace from the forwarded IP", () => {
    const ctx = auditContextFromRequest(
      makeRequest({ "x-forwarded-for": "  198.51.100.7  , 10.0.0.1" }),
    );
    expect(ctx.ipAddress).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const ctx = auditContextFromRequest(
      makeRequest({ "x-real-ip": "192.0.2.42" }),
    );
    expect(ctx.ipAddress).toBe("192.0.2.42");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const ctx = auditContextFromRequest(
      makeRequest({
        "x-forwarded-for": "203.0.113.9",
        "x-real-ip": "192.0.2.42",
      }),
    );
    expect(ctx.ipAddress).toBe("203.0.113.9");
  });

  it("captures user-agent", () => {
    const ctx = auditContextFromRequest(
      makeRequest({ "user-agent": "Mozilla/5.0 (test)" }),
    );
    expect(ctx.userAgent).toBe("Mozilla/5.0 (test)");
  });

  it("captures x-request-id", () => {
    const ctx = auditContextFromRequest(
      makeRequest({ "x-request-id": "req_abc123" }),
    );
    expect(ctx.requestId).toBe("req_abc123");
  });

  it("falls back to x-vercel-id when x-request-id is missing", () => {
    const ctx = auditContextFromRequest(
      makeRequest({ "x-vercel-id": "iad1::xyz" }),
    );
    expect(ctx.requestId).toBe("iad1::xyz");
  });

  it("prefers x-request-id over x-vercel-id", () => {
    const ctx = auditContextFromRequest(
      makeRequest({
        "x-request-id": "req_priority",
        "x-vercel-id": "iad1::xyz",
      }),
    );
    expect(ctx.requestId).toBe("req_priority");
  });
});
