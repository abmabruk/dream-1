import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";

import { VendorsPage } from "./vendors-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePermission("vendors:view");
  const canManage = hasPermission(session.role, "vendors:manage");
  return <VendorsPage canManage={canManage} />;
}
