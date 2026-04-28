export const dynamic = "force-dynamic";

import { fail } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AttachmentService } from "@/modules/memory/attachment.service";
import { readStoredFile } from "@/modules/memory/storage";

const service = new AttachmentService();

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const result = await withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");
    if (!access.ok) return access.response;
    const { attachmentId } = await context.params;

    const row = await service.findForDownload(
      access.session.factoryId,
      access.session.role,
      attachmentId,
    );

    let buffer: Buffer;
    try {
      buffer = await readStoredFile(row.factoryId, row.taskId, row.storedName);
    } catch {
      return fail("الملف غير متوفر.", 404);
    }

    const headers = new Headers();
    headers.set("Content-Type", row.mimeType || "application/octet-stream");
    headers.set("Content-Length", String(buffer.byteLength));
    // inline so images render in <img> and PDFs open in new tab
    headers.set(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    );
    headers.set("Cache-Control", "private, max-age=0, no-store");
    // BodyInit: convert Node Buffer to ArrayBuffer slice for fetch Response
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    return new Response(ab, { status: 200, headers });
  });
  return result;
}
