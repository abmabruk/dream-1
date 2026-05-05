import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CreateInvoiceInput,
  CREDIT_NOTE_STATUS_LABELS_AR,
  CREDIT_NOTE_STATUS_VALUES,
  CreditNoteStatusEnum,
  INVOICE_STATUS_LABELS_AR,
  INVOICE_STATUS_VALUES,
  InvoiceLineInput,
  InvoiceStatusEnum,
  UpdateInvoiceInput,
} from "./invoice.schemas";

const baseLine = {
  description: "بلاط رخامي 60×60",
  quantity: 2,
  unitPrice: 100,
};

const baseInvoice = {
  customerId: "cust_1",
  taxRate: 15,
  taxInclusive: false,
  lines: [baseLine],
};

describe("InvoiceLineInput schema", () => {
  it("accepts a minimal valid line", () => {
    expect(InvoiceLineInput.safeParse(baseLine).success).toBe(true);
  });

  it("rejects empty description", () => {
    expect(
      InvoiceLineInput.safeParse({ ...baseLine, description: "" }).success,
    ).toBe(false);
  });

  it("rejects zero or negative quantity", () => {
    expect(
      InvoiceLineInput.safeParse({ ...baseLine, quantity: 0 }).success,
    ).toBe(false);
    expect(
      InvoiceLineInput.safeParse({ ...baseLine, quantity: -2 }).success,
    ).toBe(false);
  });

  it("rejects negative unitPrice but allows zero", () => {
    expect(
      InvoiceLineInput.safeParse({ ...baseLine, unitPrice: -1 }).success,
    ).toBe(false);
    expect(
      InvoiceLineInput.safeParse({ ...baseLine, unitPrice: 0 }).success,
    ).toBe(true);
  });

  it("coerces string numerics", () => {
    const r = InvoiceLineInput.parse({
      ...baseLine,
      quantity: "3",
      unitPrice: "12.50",
    });
    expect(r.quantity).toBeCloseTo(3);
    expect(r.unitPrice).toBeCloseTo(12.5);
  });
});

describe("CreateInvoiceInput schema", () => {
  it("accepts the minimum required (customerId)", () => {
    expect(CreateInvoiceInput.safeParse({ customerId: "cust_1" }).success).toBe(
      true,
    );
  });

  it("rejects empty customerId", () => {
    expect(CreateInvoiceInput.safeParse({ customerId: "" }).success).toBe(false);
  });

  it("requires customerId field", () => {
    expect(CreateInvoiceInput.safeParse({}).success).toBe(false);
  });

  it("accepts a full payload with lines", () => {
    expect(CreateInvoiceInput.safeParse(baseInvoice).success).toBe(true);
  });

  it("rejects taxRate above 100 or below 0", () => {
    expect(
      CreateInvoiceInput.safeParse({ ...baseInvoice, taxRate: 101 }).success,
    ).toBe(false);
    expect(
      CreateInvoiceInput.safeParse({ ...baseInvoice, taxRate: -1 }).success,
    ).toBe(false);
  });

  it("defaults lines to empty array", () => {
    const r = CreateInvoiceInput.parse({ customerId: "cust_1" });
    expect(r.lines).toEqual([]);
  });

  it("propagates line validation errors", () => {
    expect(
      CreateInvoiceInput.safeParse({
        ...baseInvoice,
        lines: [{ ...baseLine, quantity: -1 }],
      }).success,
    ).toBe(false);
  });

  it("rejects notes longer than 2000 chars", () => {
    expect(
      CreateInvoiceInput.safeParse({
        ...baseInvoice,
        notes: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("UpdateInvoiceInput schema", () => {
  it("accepts an empty update (all partial)", () => {
    expect(UpdateInvoiceInput.safeParse({}).success).toBe(true);
  });

  it("accepts each field individually", () => {
    expect(UpdateInvoiceInput.safeParse({ taxRate: 5 }).success).toBe(true);
    expect(UpdateInvoiceInput.safeParse({ taxInclusive: true }).success).toBe(
      true,
    );
    expect(UpdateInvoiceInput.safeParse({ dueDate: "2026-12-31" }).success).toBe(
      true,
    );
    expect(UpdateInvoiceInput.safeParse({ notes: "n" }).success).toBe(true);
    expect(UpdateInvoiceInput.safeParse({ discountAmount: 10 }).success).toBe(
      true,
    );
    expect(UpdateInvoiceInput.safeParse({ lines: [baseLine] }).success).toBe(
      true,
    );
  });

  it("rejects taxRate >100", () => {
    expect(UpdateInvoiceInput.safeParse({ taxRate: 150 }).success).toBe(false);
  });

  it("propagates line validation errors", () => {
    expect(
      UpdateInvoiceInput.safeParse({
        lines: [{ ...baseLine, unitPrice: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe("Void invoice body schema", () => {
  // Void body shape: { reason: string >= 2 }
  const VoidInvoiceBody = z.object({
    reason: z.string().min(2).max(500),
  });

  it("requires reason >= 2 chars", () => {
    expect(VoidInvoiceBody.safeParse({ reason: "" }).success).toBe(false);
    expect(VoidInvoiceBody.safeParse({ reason: "x" }).success).toBe(false);
    expect(VoidInvoiceBody.safeParse({ reason: "ok" }).success).toBe(true);
    expect(VoidInvoiceBody.safeParse({ reason: "duplicate" }).success).toBe(true);
  });
});

describe("InvoiceStatusEnum", () => {
  it.each(INVOICE_STATUS_VALUES)("accepts %s", (v) => {
    expect(InvoiceStatusEnum.safeParse(v).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(InvoiceStatusEnum.safeParse("FOO").success).toBe(false);
  });

  it("has Arabic label for every status", () => {
    for (const s of INVOICE_STATUS_VALUES) {
      expect(INVOICE_STATUS_LABELS_AR[s]).toBeTruthy();
    }
  });
});

describe("CreditNoteStatusEnum", () => {
  it.each(CREDIT_NOTE_STATUS_VALUES)("accepts %s", (v) => {
    expect(CreditNoteStatusEnum.safeParse(v).success).toBe(true);
  });

  it("has Arabic label for every status", () => {
    for (const s of CREDIT_NOTE_STATUS_VALUES) {
      expect(CREDIT_NOTE_STATUS_LABELS_AR[s]).toBeTruthy();
    }
  });
});
