export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return fail("Unauthorized cron request", 401);
  }
  // TODO: Phase 4b — scan invoices, mark overdue, send notifications.
  return ok({ ran: "invoice-overdue", at: new Date().toISOString(), processed: 0 });
}
