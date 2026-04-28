import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { CostService } from "@/modules/finance/cost.service";

import { FinancePage } from "./finance-page";

const service = new CostService();

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default async function FinanceRoute({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; categories?: string }>;
}) {
  const session = await requirePermission("costs:view");
  const canManageCosts = hasPermission(session.role, "costs:manage");
  const sp = await searchParams;

  const from = sp.from ? new Date(sp.from) : startOfMonth();
  const to = sp.to ? new Date(sp.to) : endOfMonth();
  const categories = service.parseCategoriesParam(sp.categories ?? null);

  const summary = await service.summaryByFactory(
    session.factoryId,
    session.role,
    { from, to, categories },
  );

  return (
    <FinancePage
      summary={summary}
      canManageCosts={canManageCosts}
      defaultFrom={from.toISOString().slice(0, 10)}
      defaultTo={to.toISOString().slice(0, 10)}
      defaultCategories={categories ?? []}
    />
  );
}
