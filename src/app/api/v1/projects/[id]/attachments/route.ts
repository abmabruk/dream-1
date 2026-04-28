export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AttachmentService } from "@/modules/memory/attachment.service";

const service = new AttachmentService();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { id } = await context.params;
    const attachments = await service.listByProject(
      access.session.factoryId,
      access.session.role,
      id,
    );
    return ok({ attachments });
  });
}
