export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { StageTemplateService } from "@/modules/projects/stage-template.service";

const service = new StageTemplateService();

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.orderedIds)) {
      return fail("Body must be { orderedIds: string[] }", 400);
    }

    const result = await service.reorder(access.session.factoryId, body);
    return ok(result);
  });
}
