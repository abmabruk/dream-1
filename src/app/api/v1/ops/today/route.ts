export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("ops:view");

    if (!access.ok) {
      return access.response;
    }

    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    const board = await service.getOpsBoard(access.session.factoryId, { date });

    return ok(board);
  });
}
