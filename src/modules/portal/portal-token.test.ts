import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("portal token signing", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      DATABASE_URL: "https://example.com/db",
      AUTH_SECRET: "12345678901234567890123456789012",
      APP_URL: "http://localhost:2500",
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("round-trips a signed customer portal token", async () => {
    const { signPortalToken, verifyPortalToken } = await import("./portal-token");
    const token = await signPortalToken({
      accessId: "access_1",
      orderId: "order_1",
    });

    await expect(verifyPortalToken(token)).resolves.toEqual({
      typ: "order_portal",
      accessId: "access_1",
      orderId: "order_1",
    });
  });

  it("fails fast when the auth secret is not production-safe", async () => {
    process.env.AUTH_SECRET = "short";
    vi.resetModules();

    const { signPortalToken } = await import("./portal-token");

    await expect(
      signPortalToken({
        accessId: "access_1",
        orderId: "order_1",
      })
    ).rejects.toThrow("AUTH_SECRET must be configured before using portal links.");
  });
});
