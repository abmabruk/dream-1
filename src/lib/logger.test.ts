import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger, newRequestId, requestLogger } from "./logger";

describe("logger", () => {
  it("exports a usable logger instance", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("has a level set (default debug in test env)", () => {
    expect(typeof logger.level).toBe("string");
    expect(logger.level.length).toBeGreaterThan(0);
  });
});

describe("newRequestId", () => {
  it("returns a non-empty string", () => {
    const id = newRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newRequestId()));
    expect(ids.size).toBe(50);
  });
});

describe("requestLogger", () => {
  it("returns a child logger with method/path bindings", () => {
    const req = new Request("https://example.com/api/things?x=1", {
      method: "POST",
    });
    const child = requestLogger(req);
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
    // pino child loggers expose bindings()
    const bindings = child.bindings();
    expect(bindings.method).toBe("POST");
    expect(bindings.path).toBe("/api/things");
    expect(typeof bindings.requestId).toBe("string");
    expect((bindings.requestId as string).length).toBeGreaterThan(0);
  });

  it("uses x-request-id header when present", () => {
    const req = new Request("https://example.com/api/x", {
      headers: { "x-request-id": "fixed-id-123" },
    });
    const child = requestLogger(req);
    expect(child.bindings().requestId).toBe("fixed-id-123");
  });

  it("respects explicit requestId option over header", () => {
    const req = new Request("https://example.com/api/x", {
      headers: { "x-request-id": "header-id" },
    });
    const child = requestLogger(req, { requestId: "explicit-id" });
    expect(child.bindings().requestId).toBe("explicit-id");
  });
});

describe("LOG_LEVEL env override", () => {
  const originalEnv = process.env.LOG_LEVEL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // reset module registry so re-import re-evaluates env
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = originalEnv;
    if (originalNodeEnv === undefined)
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    else
      (process.env as Record<string, string | undefined>).NODE_ENV =
        originalNodeEnv;
  });

  it("honors LOG_LEVEL env var when re-imported", async () => {
    process.env.LOG_LEVEL = "warn";
    vi.resetModules();
    const mod = await import("./logger");
    expect(mod.logger.level).toBe("warn");
  });
});
