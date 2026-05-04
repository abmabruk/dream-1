import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { PortalService } from "@/modules/portal/portal.service";

const portalService = new PortalService();

type RouteContext = {
  params: Promise<{
    accessId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:update");
    if (!access.ok) {
      return access.response;
    }

    const { accessId } = await context.params;

    const revoked = await portalService.revokePortalAccess(
      access.session.factoryId,
      accessId,
      access.session.userId,
    );

    if (!revoked) {
      return fail("Portal access not found", 404);
    }

    return ok({ revoked: true, accessId: revoked.id });
  });
}
