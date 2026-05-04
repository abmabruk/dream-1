import { describe, expect, it } from "vitest";

import { isCrossOrigin } from "./csrf";

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("isCrossOrigin", () => {
  it("allows same-origin via Origin header", () => {
    expect(
      isCrossOrigin(
        h({ host: "app.example.com", origin: "https://app.example.com" }),
      ),
    ).toBe(false);
  });

  it("denies when Origin host differs from Host", () => {
    expect(
      isCrossOrigin(
        h({ host: "app.example.com", origin: "https://evil.example.com" }),
      ),
    ).toBe(true);
  });

  it("falls back to Referer when Origin missing — same-origin allowed", () => {
    expect(
      isCrossOrigin(
        h({
          host: "app.example.com",
          referer: "https://app.example.com/sign-in",
        }),
      ),
    ).toBe(false);
  });

  it("denies when Referer is cross-origin and Origin missing", () => {
    expect(
      isCrossOrigin(
        h({
          host: "app.example.com",
          referer: "https://evil.example.com/x",
        }),
      ),
    ).toBe(true);
  });

  it("denies when Host header is missing", () => {
    expect(isCrossOrigin(h({ origin: "https://app.example.com" }))).toBe(true);
  });

  it("denies when both Origin and Referer are missing", () => {
    expect(isCrossOrigin(h({ host: "app.example.com" }))).toBe(true);
  });

  it("denies when Origin is malformed", () => {
    expect(
      isCrossOrigin(h({ host: "app.example.com", origin: "not-a-url" })),
    ).toBe(true);
  });
});
