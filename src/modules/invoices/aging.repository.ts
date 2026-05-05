import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/** Raw row used by the aging report — minimal columns to keep payload small. */
export interface AgingInvoiceRow {
  id: string;
  customerId: string;
  customerName: string;
  issueDate: Date;
  dueDate: Date | null;
  total: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
}

export class AgingRepository {
  /**
   * Returns every open invoice (SENT / PARTIALLY_PAID / OVERDUE) for the
   * factory along with the customer name, soft-deleted rows excluded.
   * Filtering by `outstanding > 0` is done in the service so we keep this
   * query simple and let Postgres use the (factoryId, status) index.
   */
  async listOpenForAging(factoryId: string): Promise<AgingInvoiceRow[]> {
    const rows = await db.invoice.findMany({
      where: {
        factoryId,
        deletedAt: null,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: {
        id: true,
        customerId: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customer?.name ?? "—",
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      total: r.total,
      amountPaid: r.amountPaid,
    }));
  }

  /**
   * Atomic bulk-mark of SENT invoices whose dueDate has passed.
   * Idempotent — safe to invoke from a cron repeatedly; rows already in
   * OVERDUE are not touched because the WHERE clause filters by status=SENT.
   */
  async markOverdueBatch(now: Date): Promise<number> {
    const result = await db.invoice.updateMany({
      where: {
        status: "SENT",
        dueDate: { lt: now, not: null },
        deletedAt: null,
      },
      data: { status: "OVERDUE" },
    });
    return result.count;
  }

  async markOverdueBatchForFactory(factoryId: string, now: Date): Promise<number> {
    const result = await db.invoice.updateMany({
      where: {
        factoryId,
        status: "SENT",
        dueDate: { lt: now, not: null },
        deletedAt: null,
      },
      data: { status: "OVERDUE" },
    });
    return result.count;
  }
}
