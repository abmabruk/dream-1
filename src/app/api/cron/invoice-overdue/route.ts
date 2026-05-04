export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { AgingRepository } from "@/modules/invoices/aging.repository";

const repo = new AgingRepository();

/**
 * Cron: scan SENT invoices whose dueDate is past and flip them to OVERDUE.
 * Idempotent — repeat invocations are safe because the WHERE clause filters
 * by status=SENT, so already-OVERDUE rows are not re-touched.
 *
 * NOTE: AuditLog model does not yet exist in the schema, so we record only
 * the batch outcome in the response. Per-row audit can be added when the
 * AuditLog model lands.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return fail("Unauthorized cron request", 401);
  }
  const now = new Date();
  const markedOverdue = await repo.markOverdueBatch(now);
  return ok({
    ran: "invoice-overdue",
    at: now.toISOString(),
    markedOverdue,
  });
}
