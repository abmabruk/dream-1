import { describe, expect, it } from "vitest";

import {
  COST_CATEGORY_LABELS_AR,
  COST_CATEGORY_TONE,
  COST_CATEGORY_VALUES,
  CostCategoryEnum,
  CostInput,
} from "./cost.schemas";

const baseInput = {
  projectId: "proj_1",
  category: "MATERIAL" as const,
  amount: 100,
  currency: "SAR",
  description: "بلاط حمامات",
  incurredAt: "2026-04-28",
};

describe("CostInput schema", () => {
  it("accepts a minimal valid input", () => {
    const r = CostInput.safeParse(baseInput);
    expect(r.success).toBe(true);
  });

  it("coerces a numeric string to a number", () => {
    const r = CostInput.parse({ ...baseInput, amount: "250.55" });
    expect(r.amount).toBeCloseTo(250.55);
  });

  it("rejects zero or negative amounts", () => {
    expect(CostInput.safeParse({ ...baseInput, amount: 0 }).success).toBe(false);
    expect(CostInput.safeParse({ ...baseInput, amount: -1 }).success).toBe(false);
  });

  it("rejects amounts above the cap", () => {
    expect(
      CostInput.safeParse({ ...baseInput, amount: 99999999.99 }).success,
    ).toBe(true);
    expect(
      CostInput.safeParse({ ...baseInput, amount: 100000000 }).success,
    ).toBe(false);
  });

  it("rejects descriptions shorter than 2 characters", () => {
    expect(
      CostInput.safeParse({ ...baseInput, description: "" }).success,
    ).toBe(false);
    expect(
      CostInput.safeParse({ ...baseInput, description: "a" }).success,
    ).toBe(false);
  });

  it("rejects descriptions longer than 400 characters", () => {
    const desc = "أ".repeat(401);
    expect(
      CostInput.safeParse({ ...baseInput, description: desc }).success,
    ).toBe(false);
  });

  it("rejects an unknown category enum value", () => {
    const r = CostInput.safeParse({ ...baseInput, category: "BANANA" });
    expect(r.success).toBe(false);
  });

  it("defaults missing category to OTHER", () => {
    const { category: _omit, ...rest } = baseInput;
    void _omit;
    const r = CostInput.parse(rest);
    expect(r.category).toBe("OTHER");
  });

  it("defaults missing currency to SAR", () => {
    const { currency: _omit, ...rest } = baseInput;
    void _omit;
    const r = CostInput.parse(rest);
    expect(r.currency).toBe("SAR");
  });

  it("requires a non-empty projectId", () => {
    expect(
      CostInput.safeParse({ ...baseInput, projectId: "" }).success,
    ).toBe(false);
  });

  it("rejects empty currency code", () => {
    expect(
      CostInput.safeParse({ ...baseInput, currency: "S" }).success,
    ).toBe(false);
  });

  it("requires incurredAt", () => {
    expect(
      CostInput.safeParse({ ...baseInput, incurredAt: "" }).success,
    ).toBe(false);
  });

  it("accepts optional taskId, vendorName, receiptUrl", () => {
    const r = CostInput.safeParse({
      ...baseInput,
      taskId: "task_1",
      vendorName: "Acme",
      receiptUrl: "https://example.com/r.pdf",
    });
    expect(r.success).toBe(true);
  });

  it("rejects vendorName longer than 200 characters", () => {
    expect(
      CostInput.safeParse({
        ...baseInput,
        vendorName: "أ".repeat(201),
      }).success,
    ).toBe(false);
  });
});

describe("CostCategoryEnum", () => {
  it.each(COST_CATEGORY_VALUES)("accepts %s", (v) => {
    expect(CostCategoryEnum.safeParse(v).success).toBe(true);
  });
});

describe("COST_CATEGORY_LABELS_AR / TONE coverage", () => {
  it("has an Arabic label for every category", () => {
    for (const c of COST_CATEGORY_VALUES) {
      expect(COST_CATEGORY_LABELS_AR[c]).toBeTruthy();
    }
  });

  it("has a tone for every category", () => {
    for (const c of COST_CATEGORY_VALUES) {
      expect(COST_CATEGORY_TONE[c]).toBeTruthy();
    }
  });
});
