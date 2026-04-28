export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AttachmentService } from "@/modules/memory/attachment.service";

const service = new AttachmentService();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { attachmentId } = await context.params;
    const result = await service.deleteById(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      attachmentId,
    );
    return ok(result);
  });
}
