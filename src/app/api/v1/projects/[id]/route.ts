export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");

    if (!access.ok) {
      return access.response;
    }

    const { id } = await context.params;
    const workDate =
      new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const project = await service.getById(access.session.factoryId, id, workDate);

    return ok(project);
  });
}
