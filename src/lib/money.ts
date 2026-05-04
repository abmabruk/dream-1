import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Dream 1 — canonical money helpers (server only).
 *
 * All financial code (Quote, Invoice, Payment, ProjectCost) MUST use this
 * module rather than performing arithmetic on `number` directly. We standardise
 * on `Prisma.Decimal` (decimal.js) so we never lose precision crossing the
 * Postgres `Decimal(14,2)` boundary, and we standardise on banker's rounding
 * (ROUND_HALF_EVEN) so summing many lines does not introduce systematic bias.
 *
 * For client-facing display, keep using `src/lib/format.ts` (`formatSAR`).
 * This module deals with arithmetic and serialization, not localisation.
 */

/**
 * Banker's rounding (half-to-even) applied at 2 decimals.
 * Use this for all final amount totals to avoid systematic bias.
 *
 * Why banker's rounding: when summing many lines (e.g. tax across 1000 quote lines),
 * round-half-up systematically inflates totals. ROUND_HALF_EVEN is the IEEE 754 default
 * and is required by IFRS/GAAP for financial reporting.
 */
export function roundMoney(value: Prisma.Decimal | number | string): Prisma.Decimal {
  const d = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
}

/** Round a unit price to 4 decimals (banker's). */
export function roundUnitPrice(value: Prisma.Decimal | number | string): Prisma.Decimal {
  const d = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return d.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_EVEN);
}

/** Multiply quantity * unitPrice, round to 2 decimals (line total). */
export function lineTotal(
  quantity: Prisma.Decimal | number | string,
  unitPrice: Prisma.Decimal | number | string,
): Prisma.Decimal {
  const q = quantity instanceof Prisma.Decimal ? quantity : new Prisma.Decimal(quantity);
  const p = unitPrice instanceof Prisma.Decimal ? unitPrice : new Prisma.Decimal(unitPrice);
  return roundMoney(q.times(p));
}

/** Sum a list of money values; result is rounded to 2 decimals. */
export function sumMoney(values: Array<Prisma.Decimal | number | string>): Prisma.Decimal {
  const total = values.reduce<Prisma.Decimal>((acc, v) => {
    const d = v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
    return acc.plus(d);
  }, new Prisma.Decimal(0));
  return roundMoney(total);
}

/**
 * Compute tax + total from a subtotal.
 * - mode "exclusive": subtotal is pre-tax; tax is added on top.
 * - mode "inclusive": subtotal already contains tax; we extract it.
 *
 * taxRate is a percentage: 15 means 15%.
 */
export interface TaxBreakdown {
  /** pre-tax amount (rounded to 2 decimals) */
  subtotal: Prisma.Decimal;
  /** tax portion (rounded to 2 decimals) */
  taxAmount: Prisma.Decimal;
  /** total amount (rounded to 2 decimals) */
  total: Prisma.Decimal;
}

export function computeTax(
  subtotal: Prisma.Decimal | number | string,
  taxRate: Prisma.Decimal | number | string,
  mode: "exclusive" | "inclusive" = "exclusive",
): TaxBreakdown {
  const sub = subtotal instanceof Prisma.Decimal ? subtotal : new Prisma.Decimal(subtotal);
  const rate = taxRate instanceof Prisma.Decimal ? taxRate : new Prisma.Decimal(taxRate);
  const ratio = rate.div(100);

  if (mode === "inclusive") {
    // subtotal contains tax; extract it.
    // pre-tax = total / (1 + rate)
    // tax     = total - pre-tax
    const preTax = sub.div(ratio.plus(1));
    const tax = sub.minus(preTax);
    return {
      subtotal: roundMoney(preTax),
      taxAmount: roundMoney(tax),
      total: roundMoney(sub),
    };
  }

  // exclusive
  const tax = sub.times(ratio);
  const total = sub.plus(tax);
  return {
    subtotal: roundMoney(sub),
    taxAmount: roundMoney(tax),
    total: roundMoney(total),
  };
}

/** Convert a Decimal to a plain number safely (for client transport). Loses precision past 15 sig digits. */
export function decToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value.toString());
}

/** Convert a Decimal to a serializable string (preferred for API responses). */
export function decToString(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  return value.toFixed(2);
}

/** Validate a money input from user/external source. Throws on invalid. */
export function parseMoneyInput(input: unknown): Prisma.Decimal {
  if (typeof input === "number" && Number.isFinite(input)) {
    return new Prisma.Decimal(input);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Invalid money input: ${input}`);
    }
    return new Prisma.Decimal(trimmed);
  }
  if (input instanceof Prisma.Decimal) {
    return input;
  }
  throw new Error(`Money input must be number or numeric string, got ${typeof input}`);
}
