export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; locationId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => ({}));
    const { id, locationId } = await context.params;
    const result = await service.cloneLocation(
      access.session.factoryId,
      access.session.userId,
      locationId,
      id,
      body ?? {},
    );
    return ok(result);
  });
}
