import { describe, expect, it } from "vitest";

import {
  ConvertInquiryInput,
  createInquirySchema,
  inquirySourceSchema,
  inquiryStageSchema,
  updateInquiryStageSchema,
} from "./inquiry.schemas";

const baseInquiry = {
  name: "أحمد العتيبي",
  phone: "0551234567",
  source: "INSTAGRAM" as const,
};

describe("createInquirySchema", () => {
  it("accepts a minimal valid inquiry", () => {
    expect(createInquirySchema.safeParse(baseInquiry).success).toBe(true);
  });

  it("rejects names shorter than 3 characters", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, name: "أب" }).success,
    ).toBe(false);
  });

  it("rejects names longer than 160 characters", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, name: "x".repeat(161) })
        .success,
    ).toBe(false);
  });

  it("rejects phone shorter than 7 characters", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, phone: "12345" }).success,
    ).toBe(false);
  });

  it("rejects malformed email but accepts well-formed", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, email: "not-an-email" })
        .success,
    ).toBe(false);
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, email: "a@b.com" })
        .success,
    ).toBe(true);
  });

  it("treats empty string for email as undefined (optional)", () => {
    const r = createInquirySchema.parse({ ...baseInquiry, email: "" });
    expect(r.email).toBeUndefined();
  });

  it("rejects negative budgetAmount", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, budgetAmount: -1 })
        .success,
    ).toBe(false);
  });

  it("accepts zero budgetAmount", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, budgetAmount: 0 })
        .success,
    ).toBe(true);
  });

  it("rejects unknown source value", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, source: "FACEBOOK" })
        .success,
    ).toBe(false);
  });

  it("rejects notes longer than 1000 chars", () => {
    expect(
      createInquirySchema.safeParse({ ...baseInquiry, notes: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });

  it("requires source", () => {
    const { source: _s, ...rest } = baseInquiry;
    void _s;
    expect(createInquirySchema.safeParse(rest).success).toBe(false);
  });
});

describe("updateInquiryStageSchema", () => {
  it("accepts valid stage update", () => {
    expect(
      updateInquiryStageSchema.safeParse({
        inquiryId: "inq_1",
        stage: "QUALIFIED",
      }).success,
    ).toBe(true);
  });

  it("rejects empty inquiryId", () => {
    expect(
      updateInquiryStageSchema.safeParse({ inquiryId: "", stage: "NEW" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown stage", () => {
    expect(
      updateInquiryStageSchema.safeParse({ inquiryId: "inq_1", stage: "FOO" })
        .success,
    ).toBe(false);
  });
});

describe("ConvertInquiryInput", () => {
  it("requires orderTitle min length 2", () => {
    expect(ConvertInquiryInput.safeParse({ orderTitle: "a" }).success).toBe(
      false,
    );
    expect(ConvertInquiryInput.safeParse({ orderTitle: "ab" }).success).toBe(
      true,
    );
  });

  it("rejects malformed customerEmail", () => {
    expect(
      ConvertInquiryInput.safeParse({
        orderTitle: "Marble Job",
        customerEmail: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects customerPhone shorter than 8", () => {
    expect(
      ConvertInquiryInput.safeParse({
        orderTitle: "Marble Job",
        customerPhone: "1234567",
      }).success,
    ).toBe(false);
  });

  it("treats empty optional strings as undefined", () => {
    const r = ConvertInquiryInput.parse({
      orderTitle: "Marble Job",
      customerEmail: "",
      customerPhone: "",
      customerCity: "",
    });
    expect(r.customerEmail).toBeUndefined();
    expect(r.customerPhone).toBeUndefined();
    expect(r.customerCity).toBeUndefined();
  });
});

describe("enum schemas", () => {
  it("inquiryStageSchema accepts all known stages", () => {
    for (const s of [
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "QUOTED",
      "WON",
      "LOST",
    ]) {
      expect(inquiryStageSchema.safeParse(s).success).toBe(true);
    }
  });

  it("inquirySourceSchema rejects unknown source", () => {
    expect(inquirySourceSchema.safeParse("FACEBOOK").success).toBe(false);
  });
});
