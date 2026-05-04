import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetRateLimit, rateLimit } from "./rate-limit";

const OPTS = { max: 5, windowMs: 15 * 60 * 1000 };

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimit();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first 5 calls and blocks the 6th", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", OPTS)).toEqual({ ok: true });
    }
    const blocked = rateLimit("k", OPTS);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfter).toBeGreaterThan(0);
    }
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", OPTS);
    expect(rateLimit("a", OPTS).ok).toBe(false);
    expect(rateLimit("b", OPTS).ok).toBe(true);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", OPTS);
    expect(rateLimit("k", OPTS).ok).toBe(false);

    vi.advanceTimersByTime(OPTS.windowMs + 1000);

    expect(rateLimit("k", OPTS)).toEqual({ ok: true });
  });

  it("retryAfter shrinks as time passes", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", OPTS);
    const first = rateLimit("k", OPTS);
    vi.advanceTimersByTime(60_000);
    const later = rateLimit("k", OPTS);
    if (!first.ok && !later.ok) {
      expect(later.retryAfter).toBeLessThan(first.retryAfter);
    } else {
      throw new Error("expected both to be blocked");
    }
  });
});
