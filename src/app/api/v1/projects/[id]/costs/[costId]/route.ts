export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CostService } from "@/modules/finance/cost.service";

const service = new CostService();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; costId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("costs:manage");
    if (!access.ok) return access.response;
    const { costId } = await context.params;

    const result = await service.deleteById(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      costId,
    );

    return ok(result);
  });
}
