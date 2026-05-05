import { describe, expect, it } from "vitest";

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_VALUES,
  type OrderWorkflowStatus,
} from "./order-status";
import {
  createOrderSchema,
  orderStatusSchema,
  updateOrderStatusSchema,
} from "./order.schemas";

const baseOrder = {
  customerId: "cus_1",
  title: "أرضيات رخام للفيلا",
};

describe("createOrderSchema", () => {
  it("accepts a minimal valid order", () => {
    expect(createOrderSchema.safeParse(baseOrder).success).toBe(true);
  });

  it("rejects empty customerId", () => {
    expect(
      createOrderSchema.safeParse({ ...baseOrder, customerId: "" }).success,
    ).toBe(false);
  });

  it("rejects title shorter than 3", () => {
    expect(
      createOrderSchema.safeParse({ ...baseOrder, title: "ab" }).success,
    ).toBe(false);
  });

  it("rejects title longer than 160", () => {
    expect(
      createOrderSchema.safeParse({ ...baseOrder, title: "x".repeat(161) })
        .success,
    ).toBe(false);
  });

  it("rejects description longer than 5000", () => {
    expect(
      createOrderSchema.safeParse({
        ...baseOrder,
        description: "x".repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("rejects negative quotedAmount", () => {
    expect(
      createOrderSchema.safeParse({ ...baseOrder, quotedAmount: -1 }).success,
    ).toBe(false);
  });

  it("accepts zero quotedAmount", () => {
    expect(
      createOrderSchema.safeParse({ ...baseOrder, quotedAmount: 0 }).success,
    ).toBe(true);
  });

  it("treats empty targetDate string as undefined", () => {
    const r = createOrderSchema.parse({ ...baseOrder, targetDate: "" });
    expect(r.targetDate).toBeUndefined();
  });
});

describe("updateOrderStatusSchema", () => {
  it("accepts a valid status update", () => {
    expect(
      updateOrderStatusSchema.safeParse({
        orderId: "ord_1",
        status: "QUOTED",
      }).success,
    ).toBe(true);
  });

  it("rejects empty orderId", () => {
    expect(
      updateOrderStatusSchema.safeParse({ orderId: "", status: "QUOTED" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown status", () => {
    expect(
      updateOrderStatusSchema.safeParse({
        orderId: "ord_1",
        status: "WHATEVER",
      }).success,
    ).toBe(false);
  });

  it("rejects note longer than 1000", () => {
    expect(
      updateOrderStatusSchema.safeParse({
        orderId: "ord_1",
        status: "QUOTED",
        note: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("orderStatusSchema", () => {
  it.each(ORDER_STATUS_VALUES)("accepts %s", (s) => {
    expect(orderStatusSchema.safeParse(s).success).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(orderStatusSchema.safeParse("FOO").success).toBe(false);
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("has Arabic label for every status", () => {
    for (const s of ORDER_STATUS_VALUES) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

describe("ORDER_STATUS_TRANSITIONS state machine", () => {
  function canTransition(
    from: OrderWorkflowStatus,
    to: OrderWorkflowStatus,
  ): boolean {
    return ORDER_STATUS_TRANSITIONS[from].includes(to);
  }

  it("allows the happy path DRAFT → QUOTED → APPROVED → IN_PRODUCTION → QUALITY_CHECK → READY_FOR_DELIVERY → DELIVERED", () => {
    const path: OrderWorkflowStatus[] = [
      "DRAFT",
      "QUOTED",
      "APPROVED",
      "IN_PRODUCTION",
      "QUALITY_CHECK",
      "READY_FOR_DELIVERY",
      "DELIVERED",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("rejects skipping straight from DRAFT to DELIVERED", () => {
    expect(canTransition("DRAFT", "DELIVERED")).toBe(false);
  });

  it("rejects skipping DRAFT → APPROVED (must go through QUOTED)", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
  });

  it("rejects skipping APPROVED → DELIVERED", () => {
    expect(canTransition("APPROVED", "DELIVERED")).toBe(false);
  });

  it("allows CANCELLED from any active state but not from DELIVERED", () => {
    for (const s of [
      "DRAFT",
      "QUOTED",
      "APPROVED",
      "IN_PRODUCTION",
      "QUALITY_CHECK",
    ] as OrderWorkflowStatus[]) {
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("DELIVERED and CANCELLED are terminal (no outgoing transitions)", () => {
    expect(ORDER_STATUS_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ORDER_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("allows QUALITY_CHECK to fall back to IN_PRODUCTION (rework)", () => {
    expect(canTransition("QUALITY_CHECK", "IN_PRODUCTION")).toBe(true);
  });

  it("allows READY_FOR_DELIVERY to fall back to IN_PRODUCTION", () => {
    expect(canTransition("READY_FOR_DELIVERY", "IN_PRODUCTION")).toBe(true);
  });

  it("rejects READY_FOR_DELIVERY → CANCELLED", () => {
    // Once shipped-ready, cancellation is not a normal path.
    expect(canTransition("READY_FOR_DELIVERY", "CANCELLED")).toBe(false);
  });

  it("rejects no-op self transitions", () => {
    for (const s of ORDER_STATUS_VALUES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});
