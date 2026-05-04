import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("me:view");
    if (!access.ok) return access.response;

    return ok({
      authenticated: true,
      user: access.session,
    });
  });
}
