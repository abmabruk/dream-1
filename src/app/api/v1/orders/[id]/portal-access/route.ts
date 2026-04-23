import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { PortalService } from "@/modules/portal/portal.service";

const portalService = new PortalService();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:view");

    if (!access.ok) {
      return access.response;
    }

    const { id } = await context.params;
    const portal = await portalService.getStaffPortalAccess(access.session.factoryId, id);

    return ok(portal);
  });
}

export async function POST(_request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:view");

    if (!access.ok) {
      return access.response;
    }

    const { id } = await context.params;
    const portal = await portalService.createStaffPortalAccess(
      access.session.factoryId,
      id,
      access.session.userId
    );

    return ok(portal, { status: 201 });
  });
}
