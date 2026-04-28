export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AttachmentService } from "@/modules/memory/attachment.service";

const service = new AttachmentService();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { taskId } = await context.params;
    const items = await service.listByTask(
      access.session.factoryId,
      access.session.role,
      taskId,
    );
    return ok({ attachments: items });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { taskId } = await context.params;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return fail("Multipart form-data required.", 400);
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("No file uploaded under 'file'.", 400);
    }

    const created = await service.upload(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      taskId,
      file,
    );
    return ok({ attachment: created }, { status: 201 });
  });
}
