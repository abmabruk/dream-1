export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http/api-response";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { AgingRepository } from "@/modules/invoices/aging.repository";
import {
  emitNotifications,
  findFactoryUsersByRole,
} from "@/modules/notifications/notification.emitter";

const repo = new AgingRepository();

/**
 * Cron: scan SENT invoices whose dueDate is past and flip them to OVERDUE.
 * Idempotent — repeat invocations are safe because the WHERE clause filters
 * by status=SENT, so already-OVERDUE rows are not re-touched.
 *
 * After flipping, emits INVOICE_OVERDUE notifications to accountants per
 * factory (deduped by dedupeKey, so re-runs do not spam).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return fail("Unauthorized cron request", 401);
  }
  const now = new Date();

  // Capture rows that will be flipped BEFORE the bulk update so we can
  // notify with relevant metadata.
  const toFlip = await db.invoice.findMany({
    where: {
      status: "SENT",
      dueDate: { lt: now, not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      factoryId: true,
      number: true,
      total: true,
      customer: { select: { name: true } },
    },
  });

  const markedOverdue = await repo.markOverdueBatch(now);

  // Group by factory and notify accountants.
  const byFactory = new Map<string, typeof toFlip>();
  for (const inv of toFlip) {
    const arr = byFactory.get(inv.factoryId) ?? [];
    arr.push(inv);
    byFactory.set(inv.factoryId, arr);
  }

  for (const [factoryId, invoices] of byFactory) {
    try {
      const accountants = await findFactoryUsersByRole(factoryId, [
        "ACCOUNTANT",
        "OWNER",
        "FACTORY_MANAGER",
      ]);
      const drafts = invoices.flatMap((inv) =>
        accountants.map((u) => ({
          factoryId,
          userId: u.id,
          type: "INVOICE_OVERDUE" as const,
          dedupeKey: `INVOICE_OVERDUE:${inv.id}`,
          title: `الفاتورة ${inv.number} متأخرة`,
          message: `الفاتورة ${inv.number} للعميل ${inv.customer?.name ?? ""} بقيمة ${inv.total.toString()} متأخرة عن السداد.`,
          href: `/app/invoices/${inv.id}`,
          entityType: "INVOICE",
          entityId: inv.id,
        })),
      );
      await emitNotifications(drafts);
    } catch (err) {
       
      console.error("[invoice-overdue cron] notify failed", { factoryId, err });
    }
  }

  return ok({
    ran: "invoice-overdue",
    at: now.toISOString(),
    markedOverdue,
    notifiedFactories: byFactory.size,
  });
}
