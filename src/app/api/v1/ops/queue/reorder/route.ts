import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("ops:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const queue = await service.reorderQueue(
      access.session.factoryId,
      access.session.userId,
      body
    );

    return ok(queue);
  });
}
