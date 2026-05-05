import { describe, expect, it } from "vitest";

import {
  CreateQuoteInput,
  QuoteLineInput,
  QuoteStatusEnum,
  QUOTE_STATUS_LABELS_AR,
  QUOTE_STATUS_VALUES,
  UpdateQuoteInput,
} from "./quote.schemas";

const baseLine = {
  description: "بلاط رخامي 60×60",
  quantity: 2,
  unitPrice: 100,
};

const baseQuote = {
  orderId: "order_1",
  taxRate: 15,
  taxInclusive: false,
  lines: [baseLine],
};

describe("QuoteLineInput schema", () => {
  it("accepts a minimal valid line", () => {
    expect(QuoteLineInput.safeParse(baseLine).success).toBe(true);
  });

  it("requires a non-empty description (min length 1)", () => {
    expect(
      QuoteLineInput.safeParse({ ...baseLine, description: "" }).success,
    ).toBe(false);
  });

  it("rejects descriptions longer than 500 characters", () => {
    expect(
      QuoteLineInput.safeParse({
        ...baseLine,
        description: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("rejects zero or negative quantities", () => {
    expect(
      QuoteLineInput.safeParse({ ...baseLine, quantity: 0 }).success,
    ).toBe(false);
    expect(
      QuoteLineInput.safeParse({ ...baseLine, quantity: -1 }).success,
    ).toBe(false);
  });

  it("rejects negative unitPrice but allows zero", () => {
    expect(
      QuoteLineInput.safeParse({ ...baseLine, unitPrice: -0.01 }).success,
    ).toBe(false);
    expect(
      QuoteLineInput.safeParse({ ...baseLine, unitPrice: 0 }).success,
    ).toBe(true);
  });

  it("coerces numeric strings", () => {
    const r = QuoteLineInput.parse({
      ...baseLine,
      quantity: "2.5",
      unitPrice: "99.99",
    });
    expect(r.quantity).toBeCloseTo(2.5);
    expect(r.unitPrice).toBeCloseTo(99.99);
  });

  it("accepts optional productId, sku, sortOrder", () => {
    const r = QuoteLineInput.safeParse({
      ...baseLine,
      productId: "prod_1",
      sku: "SKU-001",
      sortOrder: 3,
    });
    expect(r.success).toBe(true);
  });
});

describe("CreateQuoteInput schema", () => {
  it("accepts a valid quote with lines", () => {
    expect(CreateQuoteInput.safeParse(baseQuote).success).toBe(true);
  });

  it("requires a non-empty orderId", () => {
    expect(
      CreateQuoteInput.safeParse({ ...baseQuote, orderId: "" }).success,
    ).toBe(false);
  });

  it("rejects taxRate above 100", () => {
    expect(
      CreateQuoteInput.safeParse({ ...baseQuote, taxRate: 100.01 }).success,
    ).toBe(false);
    expect(
      CreateQuoteInput.safeParse({ ...baseQuote, taxRate: 150 }).success,
    ).toBe(false);
  });

  it("rejects taxRate below 0", () => {
    expect(
      CreateQuoteInput.safeParse({ ...baseQuote, taxRate: -0.01 }).success,
    ).toBe(false);
  });

  it("accepts taxRate at boundaries 0 and 100", () => {
    expect(CreateQuoteInput.safeParse({ ...baseQuote, taxRate: 0 }).success).toBe(true);
    expect(CreateQuoteInput.safeParse({ ...baseQuote, taxRate: 100 }).success).toBe(true);
  });

  it("rejects negative discountAmount", () => {
    expect(
      CreateQuoteInput.safeParse({ ...baseQuote, discountAmount: -5 }).success,
    ).toBe(false);
  });

  it("defaults lines to an empty array", () => {
    const { lines: _omit, ...rest } = baseQuote;
    void _omit;
    const r = CreateQuoteInput.parse(rest);
    expect(r.lines).toEqual([]);
  });

  it("propagates line validation errors", () => {
    const r = CreateQuoteInput.safeParse({
      ...baseQuote,
      lines: [{ ...baseLine, quantity: -1 }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects notes longer than 2000 characters", () => {
    expect(
      CreateQuoteInput.safeParse({
        ...baseQuote,
        notes: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("accepts optional validUntil and discountReason", () => {
    expect(
      CreateQuoteInput.safeParse({
        ...baseQuote,
        validUntil: "2026-12-31",
        discountReason: "عرض رمضان",
        discountAmount: 50,
      }).success,
    ).toBe(true);
  });
});

describe("UpdateQuoteInput schema", () => {
  it("accepts an empty update", () => {
    expect(UpdateQuoteInput.safeParse({}).success).toBe(true);
  });

  it("rejects taxRate >100 on update too", () => {
    expect(UpdateQuoteInput.safeParse({ taxRate: 101 }).success).toBe(false);
  });

  it("accepts expectedUpdatedAt for optimistic concurrency", () => {
    expect(
      UpdateQuoteInput.safeParse({
        expectedUpdatedAt: "2026-05-01T10:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("propagates line validation errors", () => {
    expect(
      UpdateQuoteInput.safeParse({
        lines: [{ ...baseLine, unitPrice: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe("QuoteStatusEnum", () => {
  it.each(QUOTE_STATUS_VALUES)("accepts %s", (v) => {
    expect(QuoteStatusEnum.safeParse(v).success).toBe(true);
  });

  it("rejects unknown status values", () => {
    expect(QuoteStatusEnum.safeParse("FOO").success).toBe(false);
  });
});

describe("QUOTE_STATUS_LABELS_AR coverage", () => {
  it("has an Arabic label for every status", () => {
    for (const s of QUOTE_STATUS_VALUES) {
      expect(QUOTE_STATUS_LABELS_AR[s]).toBeTruthy();
    }
  });
});

// ConvertInquiryInput is referenced in the test brief but does not exist in
// quote.schemas.ts at the time of writing. Keeping a skipped placeholder so
// the orchestrator can re-enable when Agent B exposes it.
describe.skip("ConvertInquiryInput schema (not yet implemented)", () => {
  it("validates email format", () => {
    // expect(ConvertInquiryInput.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
