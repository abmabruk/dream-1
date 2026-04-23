import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("ops:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { id } = await context.params;
    const task = await service.reviewTask(
      access.session.factoryId,
      {
        userId: access.session.userId,
        role: access.session.role,
      },
      {
        taskId: id,
        decision: body.decision,
        note: body.note,
      }
    );

    return ok(task);
  });
}
