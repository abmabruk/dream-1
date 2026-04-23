import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { InquiryService } from "@/modules/crm/inquiry.service";

const inquiryService = new InquiryService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("crm:view");

    if (!access.ok) {
      return access.response;
    }

    const inquiries = await inquiryService.list(access.session.factoryId);

    return ok(inquiries);
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("crm:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const inquiry = await inquiryService.create(access.session.factoryId, body);

    return ok(inquiry, { status: 201 });
  });
}
