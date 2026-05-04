import { describe, expect, it } from "vitest";

import {
  CreateProductInput,
  VariantInput,
} from "./product.schemas";

const baseProduct = {
  code: "P-001",
  name: "Marble 60x60",
  defaultUnitPrice: 100,
};

describe("CreateProductInput schema", () => {
  it("accepts the minimal product (code + name + defaultUnitPrice)", () => {
    expect(CreateProductInput.safeParse(baseProduct).success).toBe(true);
  });

  it("accepts a product with variants", () => {
    const r = CreateProductInput.safeParse({
      ...baseProduct,
      variants: [
        { code: "V1", name: "60x60 White", unitPriceDelta: 0 },
        { code: "V2", name: "60x60 Black", unitPriceDelta: 5 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative defaultUnitPrice", () => {
    expect(
      CreateProductInput.safeParse({ ...baseProduct, defaultUnitPrice: -1 }).success,
    ).toBe(false);
  });

  it("accepts zero defaultUnitPrice", () => {
    expect(
      CreateProductInput.safeParse({ ...baseProduct, defaultUnitPrice: 0 }).success,
    ).toBe(true);
  });

  it("accepts decimal unit prices (4dp precision)", () => {
    const r = CreateProductInput.parse({
      ...baseProduct,
      defaultUnitPrice: 12.3456,
    });
    expect(r.defaultUnitPrice).toBeCloseTo(12.3456, 4);
  });

  it("coerces numeric strings for prices", () => {
    const r = CreateProductInput.parse({
      ...baseProduct,
      defaultUnitPrice: "99.99",
      estimatedUnitCost: "50.50",
    });
    expect(r.defaultUnitPrice).toBeCloseTo(99.99, 2);
    expect(r.estimatedUnitCost).toBeCloseTo(50.5, 2);
  });

  it("rejects an empty code or short name", () => {
    expect(
      CreateProductInput.safeParse({ ...baseProduct, code: "" }).success,
    ).toBe(false);
    expect(
      CreateProductInput.safeParse({ ...baseProduct, name: "x" }).success,
    ).toBe(false);
  });

  it("rejects defaultUnitPrice above max precision", () => {
    expect(
      CreateProductInput.safeParse({
        ...baseProduct,
        defaultUnitPrice: 100000000,
      }).success,
    ).toBe(false);
  });
});

describe("VariantInput schema", () => {
  it("requires code and name", () => {
    expect(VariantInput.safeParse({ name: "V" }).success).toBe(false);
    expect(VariantInput.safeParse({ code: "C" }).success).toBe(false);
    expect(VariantInput.safeParse({ code: "C", name: "V" }).success).toBe(true);
  });

  it("accepts arbitrary attribute keys with primitive values", () => {
    const r = VariantInput.safeParse({
      code: "C",
      name: "V",
      attributes: { color: "red", size: 60, premium: true },
    });
    expect(r.success).toBe(true);
  });

  it("rejects attribute values that are objects", () => {
    const r = VariantInput.safeParse({
      code: "C",
      name: "V",
      attributes: { nested: { x: 1 } as unknown as string },
    });
    expect(r.success).toBe(false);
  });

  it("coerces unitPriceDelta as number", () => {
    const r = VariantInput.parse({
      code: "C",
      name: "V",
      unitPriceDelta: "2.5",
    });
    expect(r.unitPriceDelta).toBeCloseTo(2.5, 2);
  });
});
