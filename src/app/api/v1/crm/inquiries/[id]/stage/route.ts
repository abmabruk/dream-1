import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { InquiryService } from "@/modules/crm/inquiry.service";

const inquiryService = new InquiryService();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("crm:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { id } = await context.params;
    const result = await inquiryService.updateStage(access.session.factoryId, {
      inquiryId: id,
      stage: body.stage,
      notes: body.notes,
      nextFollowUpAt: body.nextFollowUpAt,
    });

    return ok(result);
  });
}
