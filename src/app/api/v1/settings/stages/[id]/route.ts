export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { StageTemplateService } from "@/modules/projects/stage-template.service";

const service = new StageTemplateService();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body) return fail("Request body is required", 400);

    const result = await service.update(access.session.factoryId, id, body);
    return ok(result);
  });
}
