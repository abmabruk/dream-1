export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; stageInstanceId: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;

    const { stageInstanceId } = await context.params;

    const result = await service.startStage(
      access.session.factoryId,
      stageInstanceId,
      access.session.userId
    );

    return ok(result);
  });
}
