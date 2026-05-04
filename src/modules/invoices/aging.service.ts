import "server-only";

import { Prisma, type UserRole } from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import { decToString } from "@/lib/money";
import { hasPermission } from "@/modules/auth/roles";

import { AgingRepository } from "./aging.repository";

export type AgingBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export interface AgingBuckets {
  "0-30": string;
  "31-60": string;
  "61-90": string;
  "90+": string;
}

export interface AgingCustomerRow {
  customerId: string;
  customerName: string;
  outstanding: string;
  oldestInvoiceDays: number;
  bucket: AgingBucketKey;
  invoiceCount: number;
}

export interface FactoryAgingReport {
  asOf: string;
  buckets: AgingBuckets;
  totals: {
    totalOutstanding: string;
    invoiceCount: number;
    customerCount: number;
  };
  byCustomer: AgingCustomerRow[];
}

const ZERO = new Prisma.Decimal(0);
const MS_PER_DAY = 86_400_000;

export function bucketForDays(days: number): AgingBucketKey {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function daysBetween(from: Date, to: Date): number {
  const diff = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
  return diff < 0 ? 0 : diff;
}

export class AgingService {
  constructor(private readonly repository = new AgingRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "invoices:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض الفواتير.");
    }
  }

  async getFactoryAging(
    factoryId: string,
    role: UserRole,
    now: Date = new Date(),
  ): Promise<FactoryAgingReport> {
    this.assertView(role);

    const rows = await this.repository.listOpenForAging(factoryId);

    const bucketSums: Record<AgingBucketKey, Prisma.Decimal> = {
      "0-30": ZERO,
      "31-60": ZERO,
      "61-90": ZERO,
      "90+": ZERO,
    };

    type CustomerAgg = {
      customerId: string;
      customerName: string;
      outstanding: Prisma.Decimal;
      oldestInvoiceDays: number;
      invoiceCount: number;
    };
    const byCustomer = new Map<string, CustomerAgg>();

    let totalOutstanding = ZERO;
    let invoiceCount = 0;

    for (const row of rows) {
      const outstanding = row.total.minus(row.amountPaid);
      if (outstanding.lte(0)) continue;

      const referenceDate = row.dueDate ?? row.issueDate;
      const days = daysBetween(referenceDate, now);
      const bucket = bucketForDays(days);

      bucketSums[bucket] = bucketSums[bucket].plus(outstanding);
      totalOutstanding = totalOutstanding.plus(outstanding);
      invoiceCount += 1;

      const existing = byCustomer.get(row.customerId);
      if (existing) {
        existing.outstanding = existing.outstanding.plus(outstanding);
        if (days > existing.oldestInvoiceDays) existing.oldestInvoiceDays = days;
        existing.invoiceCount += 1;
      } else {
        byCustomer.set(row.customerId, {
          customerId: row.customerId,
          customerName: row.customerName,
          outstanding,
          oldestInvoiceDays: days,
          invoiceCount: 1,
        });
      }
    }

    const customerRows: AgingCustomerRow[] = Array.from(byCustomer.values())
      .map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        outstanding: decToString(c.outstanding),
        oldestInvoiceDays: c.oldestInvoiceDays,
        bucket: bucketForDays(c.oldestInvoiceDays),
        invoiceCount: c.invoiceCount,
      }))
      .sort((a, b) => Number(b.outstanding) - Number(a.outstanding));

    return {
      asOf: now.toISOString(),
      buckets: {
        "0-30": decToString(bucketSums["0-30"]),
        "31-60": decToString(bucketSums["31-60"]),
        "61-90": decToString(bucketSums["61-90"]),
        "90+": decToString(bucketSums["90+"]),
      },
      totals: {
        totalOutstanding: decToString(totalOutstanding),
        invoiceCount,
        customerCount: customerRows.length,
      },
      byCustomer: customerRows,
    };
  }

  /**
   * Idempotent: only flips SENT → OVERDUE for invoices past dueDate.
   * Safe to call from a cron multiple times.
   */
  async markOverdueInvoices(
    factoryId: string,
    now: Date = new Date(),
  ): Promise<{ markedCount: number }> {
    const markedCount = await this.repository.markOverdueBatchForFactory(factoryId, now);
    return { markedCount };
  }
}
