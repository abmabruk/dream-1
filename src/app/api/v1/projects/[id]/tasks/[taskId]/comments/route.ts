export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CommentService } from "@/modules/memory/comment.service";

const service = new CommentService();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { taskId } = await context.params;
    const comments = await service.listByTask(
      access.session.factoryId,
      access.session.role,
      taskId,
    );
    return ok({ comments });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { id, taskId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body) return fail("Request body is required", 400);
    const created = await service.create(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      id,
      taskId,
      body,
    );
    return ok({ comment: created }, { status: 201 });
  });
}
