export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http/api-response";
import { isAuthorizedCron } from "@/lib/cron-auth";

const RETENTION_MONTHS = 24;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return fail("Unauthorized cron request", 401);
  }
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return ok({
    ran: "audit-retention",
    at: new Date().toISOString(),
    cutoff: cutoff.toISOString(),
    deleted: result.count,
  });
}
