export const dynamic = "force-dynamic";

import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CostService } from "@/modules/finance/cost.service";

const service = new CostService();

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("costs:view");
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const catParam = url.searchParams.get("categories");

    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    const categories = service.parseCategoriesParam(catParam);

    const summary = await service.summaryByFactory(
      access.session.factoryId,
      access.session.role,
      { from, to, categories },
    );

    return ok(summary);
  });
}
