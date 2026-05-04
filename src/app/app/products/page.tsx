import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";

import { ProductsPage } from "./products-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePermission("products:view");
  const canManage = hasPermission(session.role, "products:manage");
  return <ProductsPage canManage={canManage} />;
}
