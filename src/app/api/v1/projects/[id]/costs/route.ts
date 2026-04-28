export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CostService } from "@/modules/finance/cost.service";

const service = new CostService();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("costs:view");
    if (!access.ok) return access.response;
    const { id } = await context.params;

    const [costs, summary] = await Promise.all([
      service.listByProject(access.session.factoryId, access.session.role, id),
      service.summaryByProject(access.session.factoryId, access.session.role, id),
    ]);

    return ok({ costs, summary });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("costs:manage");
    if (!access.ok) return access.response;
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body) return fail("Request body is required", 400);

    const cost = await service.create(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      { ...body, projectId: id },
    );

    return ok(cost, { status: 201 });
  });
}
