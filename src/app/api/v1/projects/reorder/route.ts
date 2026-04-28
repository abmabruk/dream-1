import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

/**
 * POST /api/v1/projects/reorder
 *
 * Body: { orderedIds: string[] }
 *
 * Persists a manual ordering for the factory's projects list.
 * The list is displayed top → bottom in the order provided.
 */
export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");
    if (!access.ok) return access.response;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.orderedIds)) {
      return fail("Body must be { orderedIds: string[] }", 400);
    }

    await service.reorderProjects(
      access.session.factoryId,
      body.orderedIds,
    );

    return ok({ reordered: body.orderedIds.length });
  });
}
