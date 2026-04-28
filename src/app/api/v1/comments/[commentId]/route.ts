export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CommentService } from "@/modules/memory/comment.service";

const service = new CommentService();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ commentId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { commentId } = await context.params;
    const result = await service.deleteById(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      commentId,
    );
    return ok(result);
  });
}
