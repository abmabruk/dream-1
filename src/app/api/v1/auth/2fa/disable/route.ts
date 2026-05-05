import { z } from "zod";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { AuthService } from "@/modules/auth/auth.service";
import { getSession } from "@/modules/auth/session";

const authService = new AuthService();

const bodySchema = z.object({
  // Disable requires a fresh 6-digit TOTP — recovery codes are not accepted.
  code: z.string().regex(/^\s*\d{6}\s*$/, "Enter a 6-digit TOTP code."),
});

export async function POST(req: Request) {
  return withRouteErrorHandling(async () => {
    const session = await getSession();
    if (!session) return fail("Authentication required", 401);

    const json = await req.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    const result = await authService.disable2fa(session.userId, body.code);
    if (!result.ok) return fail(result.message, 400);
    return ok({ enabled: false });
  });
}
