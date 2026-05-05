export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AgingService } from "@/modules/invoices/aging.service";

const service = new AgingService();

export async function GET(_request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("invoices:view");
    if (!access.ok) return access.response;
    const report = await service.getFactoryAging(
      access.session.factoryId,
      access.session.role,
    );
    return ok(report);
  });
}
