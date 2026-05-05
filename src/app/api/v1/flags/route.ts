export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { getFlags } from "@/lib/flags";

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("dashboard:view");
    if (!access.ok) return access.response;
    return ok({ flags: getFlags() });
  });
}
