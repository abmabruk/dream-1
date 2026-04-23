import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ReportingService } from "@/modules/reporting/reporting.service";

const reportingService = new ReportingService();

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("reports:view");

    if (!access.ok) {
      return access.response;
    }

    const { searchParams } = new URL(request.url);
    const overview = await reportingService.getOverview(access.session.factoryId, {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      orderStatus: searchParams.getAll("orderStatus"),
      inquiryStage: searchParams.getAll("inquiryStage"),
    });

    return ok(overview);
  });
}
