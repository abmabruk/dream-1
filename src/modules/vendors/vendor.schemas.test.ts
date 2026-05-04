import { describe, expect, it } from "vitest";

import {
  CreateVendorInput,
  VendorContactInput,
  normalizeVendorName,
} from "./vendor.schemas";

describe("CreateVendorInput schema", () => {
  it("accepts a minimal vendor (just name)", () => {
    expect(CreateVendorInput.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("accepts a full vendor with contacts", () => {
    const r = CreateVendorInput.safeParse({
      name: "Acme Co",
      code: "ACM",
      taxNumber: "300000000",
      email: "ops@acme.example",
      phone: "+966500000000",
      website: "https://acme.example",
      address: "King Fahd Rd",
      city: "Riyadh",
      paymentTermsDays: 30,
      preferredCurrency: "SAR",
      notes: "Preferred",
      contacts: [
        { name: "Ali", email: "ali@acme.example", isPrimary: true },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty / too-short name", () => {
    expect(CreateVendorInput.safeParse({ name: "" }).success).toBe(false);
    expect(CreateVendorInput.safeParse({ name: "A" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      CreateVendorInput.safeParse({ name: "Acme", email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("accepts an empty string email (schema allows literal empty)", () => {
    expect(
      CreateVendorInput.safeParse({ name: "Acme", email: "" }).success,
    ).toBe(true);
  });

  it("rejects an invalid URL for website", () => {
    expect(
      CreateVendorInput.safeParse({ name: "Acme", website: "not a url" }).success,
    ).toBe(false);
  });

  it("rejects paymentTermsDays out of range", () => {
    expect(
      CreateVendorInput.safeParse({ name: "Acme", paymentTermsDays: -1 }).success,
    ).toBe(false);
    expect(
      CreateVendorInput.safeParse({ name: "Acme", paymentTermsDays: 366 }).success,
    ).toBe(false);
  });
});

describe("normalizeVendorName helper", () => {
  it("lowercases input", () => {
    expect(normalizeVendorName("ACME")).toBe("acme");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeVendorName("  acme  ")).toBe("acme");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeVendorName("Acme   Corp\t  Ltd")).toBe("acme corp ltd");
  });

  it("treats variants of the same name as equal", () => {
    expect(normalizeVendorName("ABC Corp")).toBe(normalizeVendorName("abc corp  "));
  });
});

describe("VendorContactInput schema", () => {
  it("requires a name (min 2)", () => {
    expect(VendorContactInput.safeParse({ name: "A" }).success).toBe(false);
    expect(VendorContactInput.safeParse({ name: "Ali" }).success).toBe(true);
  });

  it("validates email when provided", () => {
    expect(
      VendorContactInput.safeParse({ name: "Ali", email: "bad" }).success,
    ).toBe(false);
    expect(
      VendorContactInput.safeParse({ name: "Ali", email: "ali@x.com" }).success,
    ).toBe(true);
  });

  it("accepts isPrimary boolean", () => {
    const r = VendorContactInput.safeParse({ name: "Ali", isPrimary: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isPrimary).toBe(true);
  });
});
