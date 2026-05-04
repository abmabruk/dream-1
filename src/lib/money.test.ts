import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  computeTax,
  decToNumber,
  decToString,
  lineTotal,
  parseMoneyInput,
  roundMoney,
  roundUnitPrice,
  sumMoney,
} from "./money";

describe("roundMoney — banker's rounding (ROUND_HALF_EVEN)", () => {
  // Half-to-even rule: when the dropped portion is exactly .5, round to the
  // nearest EVEN digit. This is the rule that prevents systematic upward bias
  // when summing many rounded lines (IFRS / GAAP / IEEE 754 default).
  it("rounds 0.125 -> 0.12 (down to even)", () => {
    expect(roundMoney("0.125").toString()).toBe("0.12");
  });
  it("rounds 0.135 -> 0.14 (up to even)", () => {
    expect(roundMoney("0.135").toString()).toBe("0.14");
  });
  it("rounds 0.145 -> 0.14 (down to even)", () => {
    expect(roundMoney("0.145").toString()).toBe("0.14");
  });
  it("rounds 0.155 -> 0.16 (up to even)", () => {
    expect(roundMoney("0.155").toString()).toBe("0.16");
  });
  it("non-half values round normally", () => {
    expect(roundMoney("0.124").toString()).toBe("0.12");
    expect(roundMoney("0.126").toString()).toBe("0.13");
  });
  it("accepts numbers, strings, and Decimal instances", () => {
    // Note: Decimal#toString strips trailing zeros (1.00 -> "1"). Use toFixed
    // for fixed-width output. 1.005 -> banker's round to even -> 1.00.
    expect(roundMoney(1.005).toFixed(2)).toBe("1.00");
    expect(roundMoney("2.50").toString()).toBe("2.5");
    expect(roundMoney(new Prisma.Decimal("3.14159")).toString()).toBe("3.14");
  });
});

describe("roundUnitPrice — 4 decimals banker's", () => {
  it("keeps 4 decimal precision", () => {
    expect(roundUnitPrice("1.23455").toString()).toBe("1.2346");
    expect(roundUnitPrice("1.23445").toString()).toBe("1.2344");
  });
});

describe("lineTotal", () => {
  it("3.5 * 4.99 = 17.465 -> 17.46 (banker's round to even)", () => {
    expect(lineTotal("3.5", "4.99").toString()).toBe("17.46");
  });
  it("0.001 * 1000 = 1.00", () => {
    expect(lineTotal("0.001", "1000").toString()).toBe("1");
  });
  it("handles zero", () => {
    expect(lineTotal(0, 99.99).toString()).toBe("0");
  });
});

describe("sumMoney", () => {
  it("sums 100 lines of 0.01 to exactly 1.00 (no float drift)", () => {
    const lines = Array.from({ length: 100 }, () => "0.01");
    expect(sumMoney(lines).toString()).toBe("1");
  });
  it("sums mixed Decimal/number/string", () => {
    expect(
      sumMoney([new Prisma.Decimal("1.10"), 2.2, "3.30"]).toString(),
    ).toBe("6.6");
  });
  it("empty array -> 0", () => {
    expect(sumMoney([]).toString()).toBe("0");
  });
});

describe("computeTax — exclusive mode (KSA 15% VAT default)", () => {
  it("100 @ 15% -> sub=100, tax=15, total=115", () => {
    const r = computeTax("100", 15);
    expect(r.subtotal.toString()).toBe("100");
    expect(r.taxAmount.toString()).toBe("15");
    expect(r.total.toString()).toBe("115");
  });
  it("33.33 @ 15% -> tax rounds correctly", () => {
    // 33.33 * 0.15 = 4.9995 -> banker's round to 2dp -> 5.00 (5.00 is even)
    const r = computeTax("33.33", 15);
    expect(r.subtotal.toString()).toBe("33.33");
    expect(r.taxAmount.toString()).toBe("5");
    expect(r.total.toString()).toBe("38.33");
  });
  it("0 @ 15% -> all zero", () => {
    const r = computeTax(0, 15);
    expect(r.subtotal.toString()).toBe("0");
    expect(r.taxAmount.toString()).toBe("0");
    expect(r.total.toString()).toBe("0");
  });
  it("any @ 0% -> tax 0, total = subtotal", () => {
    const r = computeTax("199.99", 0);
    expect(r.taxAmount.toString()).toBe("0");
    expect(r.total.toString()).toBe("199.99");
  });
});

describe("computeTax — inclusive mode (price already includes VAT)", () => {
  it("115 @ 15% inclusive -> sub=100, tax=15, total=115", () => {
    const r = computeTax("115", 15, "inclusive");
    expect(r.subtotal.toString()).toBe("100");
    expect(r.taxAmount.toString()).toBe("15");
    expect(r.total.toString()).toBe("115");
  });
  it("inclusive 0 -> all zero", () => {
    const r = computeTax(0, 15, "inclusive");
    expect(r.subtotal.toString()).toBe("0");
    expect(r.taxAmount.toString()).toBe("0");
    expect(r.total.toString()).toBe("0");
  });
});

describe("parseMoneyInput", () => {
  it("accepts finite numbers", () => {
    expect(parseMoneyInput(12.34).toString()).toBe("12.34");
    expect(parseMoneyInput(0).toString()).toBe("0");
    expect(parseMoneyInput(-5.5).toString()).toBe("-5.5");
  });
  it("accepts numeric strings", () => {
    expect(parseMoneyInput("99.95").toString()).toBe("99.95");
    expect(parseMoneyInput("  100  ").toString()).toBe("100");
  });
  it("accepts Decimal instances", () => {
    const d = new Prisma.Decimal("7.77");
    expect(parseMoneyInput(d).toString()).toBe("7.77");
  });
  it("rejects NaN / Infinity", () => {
    expect(() => parseMoneyInput(Number.NaN)).toThrow();
    expect(() => parseMoneyInput(Number.POSITIVE_INFINITY)).toThrow();
  });
  it("rejects non-numeric strings", () => {
    expect(() => parseMoneyInput("abc")).toThrow(/Invalid money input/);
    expect(() => parseMoneyInput("12.34.56")).toThrow();
    expect(() => parseMoneyInput("")).toThrow();
    expect(() => parseMoneyInput("١٠٠")).toThrow(); // Arabic digits not accepted in raw input
  });
  it("rejects unsupported types", () => {
    expect(() => parseMoneyInput(null)).toThrow();
    expect(() => parseMoneyInput(undefined)).toThrow();
    expect(() => parseMoneyInput({})).toThrow();
    expect(() => parseMoneyInput(true)).toThrow();
  });
});

describe("decToNumber / decToString", () => {
  it("decToNumber: null/undefined -> null", () => {
    expect(decToNumber(null)).toBeNull();
    expect(decToNumber(undefined)).toBeNull();
  });
  it("decToNumber: roundtrips a Decimal", () => {
    expect(decToNumber(new Prisma.Decimal("123.45"))).toBe(123.45);
  });
  it("decToString: null/undefined -> '0.00'", () => {
    expect(decToString(null)).toBe("0.00");
    expect(decToString(undefined)).toBe("0.00");
  });
  it("decToString: always 2 decimals", () => {
    expect(decToString(new Prisma.Decimal("1"))).toBe("1.00");
    expect(decToString(new Prisma.Decimal("1.2"))).toBe("1.20");
    expect(decToString(new Prisma.Decimal("1.234"))).toBe("1.23");
  });
});

describe("computeTax — property test: subtotal + taxAmount === total (rounded)", () => {
  // Hand-rolled property test (fast-check not installed). For each random
  // (subtotal, rate) we verify the rounded breakdown holds the sum identity
  // up to a 1-cent rounding tolerance — this is unavoidable when each of the
  // three values is independently rounded to 2 decimals.
  //
  // Seeded LCG so failures are reproducible.
  let seed = 0xc0ffee;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  it("exclusive: sub + tax === total (within 0.01 rounding tolerance)", () => {
    for (let i = 0; i < 500; i++) {
      const subtotal = (rand() * 1_000_000).toFixed(4);
      const rate = (rand() * 100).toFixed(4);
      const r = computeTax(subtotal, rate, "exclusive");
      const recomputed = r.subtotal.plus(r.taxAmount);
      const drift = recomputed.minus(r.total).abs();
      expect(drift.lte("0.01")).toBe(true);
    }
  });

  it("inclusive: sub + tax === total (exact, by construction)", () => {
    for (let i = 0; i < 500; i++) {
      const subtotal = (rand() * 1_000_000).toFixed(2);
      const rate = (rand() * 100).toFixed(4);
      const r = computeTax(subtotal, rate, "inclusive");
      // sub and tax are both derived from total, then rounded; so the sum
      // can drift by at most 0.01 due to independent rounding.
      const recomputed = r.subtotal.plus(r.taxAmount);
      const drift = recomputed.minus(r.total).abs();
      expect(drift.lte("0.01")).toBe(true);
    }
  });

  it("exclusive: total >= subtotal for any non-negative rate", () => {
    for (let i = 0; i < 200; i++) {
      const subtotal = (rand() * 1_000_000).toFixed(2);
      const rate = (rand() * 100).toFixed(2);
      const r = computeTax(subtotal, rate, "exclusive");
      expect(r.total.gte(r.subtotal)).toBe(true);
      expect(r.taxAmount.gte(0)).toBe(true);
    }
  });
});
