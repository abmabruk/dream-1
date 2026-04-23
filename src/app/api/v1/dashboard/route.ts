import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { DashboardService } from "@/modules/dashboard/dashboard.service";

const dashboardService = new DashboardService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("dashboard:view");

    if (!access.ok) {
      return access.response;
    }

    const snapshot = await dashboardService.getSnapshot(access.session.factoryId);

    return ok(snapshot);
  });
}
