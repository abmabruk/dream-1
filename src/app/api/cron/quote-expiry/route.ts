export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return fail("Unauthorized cron request", 401);
  }
  // TODO: Phase 2 — scan quotes past validUntil, set status=EXPIRED.
  return ok({ ran: "quote-expiry", at: new Date().toISOString(), processed: 0 });
}
