import { describe, expect, it } from "vitest";

import { updateFactorySettingsSchema } from "./settings.schemas";

const base = {
  name: "مصنع الرخام",
  timezone: "Asia/Riyadh",
  currency: "SAR",
  orderCodePrefix: "ORD",
};

describe("updateFactorySettingsSchema", () => {
  it("accepts a minimal valid settings payload", () => {
    expect(updateFactorySettingsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects name shorter than 2 chars after trim", () => {
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, name: " a " }).success,
    ).toBe(false);
  });

  it("rejects name longer than 80 chars", () => {
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, name: "x".repeat(81) })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid IANA timezone", () => {
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        timezone: "Mars/Olympus",
      }).success,
    ).toBe(false);
  });

  it("accepts other valid IANA timezones", () => {
    for (const tz of ["Europe/London", "America/New_York", "UTC"]) {
      expect(
        updateFactorySettingsSchema.safeParse({ ...base, timezone: tz })
          .success,
      ).toBe(true);
    }
  });

  it("uppercases and validates currency code", () => {
    const r = updateFactorySettingsSchema.parse({ ...base, currency: "usd" });
    expect(r.currency).toBe("USD");
  });

  it("rejects non-3-letter currency codes", () => {
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, currency: "DOLLARS" })
        .success,
    ).toBe(false);
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, currency: "US" })
        .success,
    ).toBe(false);
  });

  it("rejects currency containing digits", () => {
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, currency: "US1" })
        .success,
    ).toBe(false);
  });

  it("uppercases orderCodePrefix and validates pattern", () => {
    const r = updateFactorySettingsSchema.parse({
      ...base,
      orderCodePrefix: "ord",
    });
    expect(r.orderCodePrefix).toBe("ORD");
  });

  it("rejects orderCodePrefix shorter than 2 or longer than 8", () => {
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, orderCodePrefix: "A" })
        .success,
    ).toBe(false);
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        orderCodePrefix: "ABCDEFGHI",
      }).success,
    ).toBe(false);
  });

  it("rejects orderCodePrefix containing dashes/symbols", () => {
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        orderCodePrefix: "OR-D",
      }).success,
    ).toBe(false);
  });

  it("accepts empty string for optional supportEmail", () => {
    expect(
      updateFactorySettingsSchema.safeParse({ ...base, supportEmail: "" })
        .success,
    ).toBe(true);
  });

  it("rejects malformed supportEmail", () => {
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        supportEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("accepts well-formed supportEmail", () => {
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        supportEmail: "ops@factory.sa",
      }).success,
    ).toBe(true);
  });

  it("rejects portalDisplayName longer than 80 chars", () => {
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        portalDisplayName: "x".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("rejects supportPhone longer than 30 chars", () => {
    expect(
      updateFactorySettingsSchema.safeParse({
        ...base,
        supportPhone: "1".repeat(31),
      }).success,
    ).toBe(false);
  });
});
