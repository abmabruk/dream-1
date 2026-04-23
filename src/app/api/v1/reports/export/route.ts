import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { buildReportingCsv } from "@/modules/reporting/reporting.export";
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
    const filename = `dream-1-report-${overview.range.from}-to-${overview.range.to}.csv`;

    return new Response(buildReportingCsv(overview), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
