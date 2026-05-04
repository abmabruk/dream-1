import { z } from "zod";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { AuthService } from "@/modules/auth/auth.service";
import { getSession } from "@/modules/auth/session";

const authService = new AuthService();

const bodySchema = z.object({
  code: z.string().min(6).max(20),
  // mode: "setup" — confirm enrollment for current user (must be signed in)
  // mode: "challenge" — complete a sign-in 2FA challenge (no session yet)
  mode: z.enum(["setup", "challenge"]).default("setup"),
});

export async function POST(req: Request) {
  return withRouteErrorHandling(async () => {
    const json = await req.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    if (body.mode === "challenge") {
      const result = await authService.completeSignIn2fa(body.code);
      if (!result.ok) return fail(result.message, 400);
      return ok({ user: result.user });
    }

    // setup mode → must be authenticated
    const session = await getSession();
    if (!session) return fail("Authentication required", 401);

    const result = await authService.confirm2fa(session.userId, body.code);
    if (!result.ok) return fail(result.message, 400);
    return ok({ enabled: true });
  });
}
