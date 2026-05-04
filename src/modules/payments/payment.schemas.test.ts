import { describe, expect, it } from "vitest";

import {
  AllocationInput,
  PAYMENT_KIND_LABELS_AR,
  PAYMENT_KIND_VALUES,
  PAYMENT_METHOD_LABELS_AR,
  PAYMENT_METHOD_VALUES,
  PaymentKindEnum,
  PaymentMethodEnum,
  RecordPaymentInput,
  UpdatePaymentInput,
} from "./payment.schemas";

const minRecord = {
  customerId: "cust_1",
  amount: 100,
};

describe("RecordPaymentInput schema", () => {
  it("accepts the minimum required (customerId + amount)", () => {
    const r = RecordPaymentInput.safeParse(minRecord);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.allocations).toEqual([]);
  });

  it("rejects missing customerId", () => {
    expect(RecordPaymentInput.safeParse({ amount: 50 }).success).toBe(false);
  });

  it("rejects empty customerId", () => {
    expect(
      RecordPaymentInput.safeParse({ ...minRecord, customerId: "" }).success,
    ).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(
      RecordPaymentInput.safeParse({ ...minRecord, amount: -10 }).success,
    ).toBe(false);
  });

  it("rejects zero amount", () => {
    expect(
      RecordPaymentInput.safeParse({ ...minRecord, amount: 0 }).success,
    ).toBe(false);
  });

  it("allocations array is optional (defaults to [])", () => {
    const r = RecordPaymentInput.parse({ ...minRecord });
    expect(r.allocations).toEqual([]);
  });

  it("accepts a full payload with allocations", () => {
    const r = RecordPaymentInput.safeParse({
      ...minRecord,
      kind: "PAYMENT",
      method: "BANK_TRANSFER",
      reference: "TRN-1",
      allocations: [{ invoiceId: "inv_1", amount: 100 }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects notes longer than 2000 chars", () => {
    expect(
      RecordPaymentInput.safeParse({ ...minRecord, notes: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe("AllocationInput schema", () => {
  it("accepts a valid allocation", () => {
    expect(
      AllocationInput.safeParse({ invoiceId: "inv_1", amount: 50 }).success,
    ).toBe(true);
  });

  it("rejects missing invoiceId", () => {
    expect(AllocationInput.safeParse({ amount: 50 }).success).toBe(false);
  });

  it("rejects empty invoiceId", () => {
    expect(
      AllocationInput.safeParse({ invoiceId: "", amount: 50 }).success,
    ).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(
      AllocationInput.safeParse({ invoiceId: "inv_1", amount: -1 }).success,
    ).toBe(false);
  });

  it("rejects zero amount", () => {
    expect(
      AllocationInput.safeParse({ invoiceId: "inv_1", amount: 0 }).success,
    ).toBe(false);
  });

  it("propagates allocation validation errors when nested in RecordPaymentInput", () => {
    expect(
      RecordPaymentInput.safeParse({
        ...minRecord,
        allocations: [{ invoiceId: "inv_1", amount: -5 }],
      }).success,
    ).toBe(false);
  });
});

describe("UpdatePaymentInput schema", () => {
  it("accepts an empty update", () => {
    expect(UpdatePaymentInput.safeParse({}).success).toBe(true);
  });

  it("accepts each field individually", () => {
    expect(UpdatePaymentInput.safeParse({ method: "CASH" }).success).toBe(true);
    expect(UpdatePaymentInput.safeParse({ reference: "X" }).success).toBe(true);
    expect(UpdatePaymentInput.safeParse({ notes: "n" }).success).toBe(true);
  });
});

describe("PaymentKindEnum", () => {
  it.each(PAYMENT_KIND_VALUES)("accepts %s", (v) => {
    expect(PaymentKindEnum.safeParse(v).success).toBe(true);
  });
  it("rejects unknown kind", () => {
    expect(PaymentKindEnum.safeParse("FOO").success).toBe(false);
  });
  it("has Arabic label for every kind", () => {
    for (const k of PAYMENT_KIND_VALUES) {
      expect(PAYMENT_KIND_LABELS_AR[k]).toBeTruthy();
    }
  });
});

describe("PaymentMethodEnum", () => {
  it.each(PAYMENT_METHOD_VALUES)("accepts %s", (v) => {
    expect(PaymentMethodEnum.safeParse(v).success).toBe(true);
  });
  it("rejects unknown method", () => {
    expect(PaymentMethodEnum.safeParse("CRYPTO").success).toBe(false);
  });
  it("has Arabic label for every method", () => {
    for (const m of PAYMENT_METHOD_VALUES) {
      expect(PAYMENT_METHOD_LABELS_AR[m]).toBeTruthy();
    }
  });
});
