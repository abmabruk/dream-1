export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { id } = await context.params;
    const task = await service.updateTaskStatus(
      access.session.factoryId,
      access.session.userId,
      id,
      body.status
    );

    return ok(task);
  });
}
