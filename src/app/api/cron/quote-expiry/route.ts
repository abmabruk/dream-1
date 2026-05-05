export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http/api-response";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { emitNotification } from "@/modules/notifications/notification.emitter";

/**
 * Cron: flip DRAFT/SENT quotes whose validUntil has passed to EXPIRED, and
 * notify the quote creator. Idempotent — already-EXPIRED rows are filtered
 * out by the status WHERE clause.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return fail("Unauthorized cron request", 401);
  }
  const now = new Date();

  const expiring = await db.quote.findMany({
    where: {
      status: { in: ["DRAFT", "SENT"] },
      validUntil: { lt: now, not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      factoryId: true,
      version: true,
      orderId: true,
      createdById: true,
      order: { select: { code: true } },
    },
  });

  if (expiring.length === 0) {
    return ok({ ran: "quote-expiry", at: now.toISOString(), processed: 0 });
  }

  const ids = expiring.map((q) => q.id);
  const result = await db.quote.updateMany({
    where: { id: { in: ids } },
    data: { status: "EXPIRED" },
  });

  for (const q of expiring) {
    if (!q.createdById) continue;
    await emitNotification({
      factoryId: q.factoryId,
      userId: q.createdById,
      type: "QUOTE_EXPIRING_SOON",
      dedupeKey: `QUOTE_EXPIRING_SOON:${q.id}`,
      title: `انتهت صلاحية عرض السعر #${q.version}`,
      message: `انتهت صلاحية عرض السعر #${q.version} للطلب ${q.order?.code ?? ""}.`,
      href: `/app/orders/${q.orderId}`,
      entityType: "QUOTE",
      entityId: q.id,
    });
  }

  return ok({
    ran: "quote-expiry",
    at: now.toISOString(),
    processed: result.count,
  });
}
