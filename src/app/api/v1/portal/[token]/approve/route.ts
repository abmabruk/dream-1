import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { PortalService } from "@/modules/portal/portal.service";

const portalService = new PortalService();

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const body = await request.json().catch(() => ({}));
    const { token } = await context.params;
    const detail = await portalService.approveOrder(token, body.note);

    if (!detail) {
      return fail("Portal link not found", 404);
    }

    return ok(detail);
  });
}
