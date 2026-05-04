import { requirePermission } from "@/modules/auth/guards";
import { AgingService } from "@/modules/invoices/aging.service";

import { AgingPage } from "./aging-page";

const service = new AgingService();

export default async function FinanceAgingRoute() {
  const session = await requirePermission("invoices:view");
  const report = await service.getFactoryAging(session.factoryId, session.role);
  return <AgingPage report={report} />;
}
