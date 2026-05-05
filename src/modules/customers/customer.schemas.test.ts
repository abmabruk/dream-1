import { describe, expect, it } from "vitest";

import { createCustomerSchema } from "./customer.schemas";

const base = { name: "شركة الإعمار" };

describe("createCustomerSchema", () => {
  it("accepts minimal valid customer (name only)", () => {
    expect(createCustomerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects missing name", () => {
    expect(createCustomerSchema.safeParse({}).success).toBe(false);
  });

  it("rejects name shorter than 3 chars", () => {
    expect(createCustomerSchema.safeParse({ name: "ab" }).success).toBe(false);
  });

  it("rejects name longer than 160 chars", () => {
    expect(
      createCustomerSchema.safeParse({ name: "x".repeat(161) }).success,
    ).toBe(false);
  });

  it("accepts empty string for optional email", () => {
    expect(createCustomerSchema.safeParse({ ...base, email: "" }).success).toBe(
      true,
    );
  });

  it("rejects malformed email", () => {
    expect(
      createCustomerSchema.safeParse({ ...base, email: "not-email" }).success,
    ).toBe(false);
  });

  it("accepts well-formed email", () => {
    expect(
      createCustomerSchema.safeParse({ ...base, email: "a@b.com" }).success,
    ).toBe(true);
  });

  it("accepts empty string for optional phone", () => {
    expect(createCustomerSchema.safeParse({ ...base, phone: "" }).success).toBe(
      true,
    );
  });

  it("rejects phone shorter than 7 chars", () => {
    expect(
      createCustomerSchema.safeParse({ ...base, phone: "12345" }).success,
    ).toBe(false);
  });

  it("rejects phone longer than 30 chars", () => {
    expect(
      createCustomerSchema.safeParse({ ...base, phone: "1".repeat(31) })
        .success,
    ).toBe(false);
  });

  it("rejects city longer than 120 chars", () => {
    expect(
      createCustomerSchema.safeParse({ ...base, city: "x".repeat(121) })
        .success,
    ).toBe(false);
  });

  it("rejects notes longer than 1000 chars", () => {
    expect(
      createCustomerSchema.safeParse({ ...base, notes: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });

  it("accepts a fully populated customer", () => {
    expect(
      createCustomerSchema.safeParse({
        name: "شركة الإعمار",
        email: "info@test.com",
        phone: "0551234567",
        city: "الرياض",
        district: "العليا",
        notes: "ملاحظات",
      }).success,
    ).toBe(true);
  });
});
