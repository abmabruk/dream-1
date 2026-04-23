import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { getSession } from "@/modules/auth/session";

export async function GET() {
  return withRouteErrorHandling(async () => {
    const session = await getSession();

    return ok({
      authenticated: Boolean(session),
      session,
    });
  });
}
