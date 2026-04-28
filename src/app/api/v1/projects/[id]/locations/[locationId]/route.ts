export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; locationId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => null);
    if (!body) return fail("Request body is required", 400);
    const { locationId } = await context.params;
    const updated = await service.updateLocation(
      access.session.factoryId,
      access.session.userId,
      { ...body, locationId },
    );
    return ok(updated);
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; locationId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;
    const { locationId } = await context.params;
    const result = await service.deleteLocation(
      access.session.factoryId,
      access.session.userId,
      locationId,
    );
    return ok(result);
  });
}
