import { z } from "zod";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { AuthService } from "@/modules/auth/auth.service";
import { getSession } from "@/modules/auth/session";

const authService = new AuthService();

const bodySchema = z.object({}).optional();

export async function POST(req: Request) {
  return withRouteErrorHandling(async () => {
    const session = await getSession();
    if (!session) return fail("Authentication required", 401);

    // Body is currently empty — kept for forwards-compat / Zod validation hook.
    if (req.body) {
      try {
        const json = await req.json();
        bodySchema.parse(json);
      } catch {
        // ignore — empty body is fine
      }
    }

    const result = await authService.setup2fa(session.userId);

    return ok({
      // NOTE: secret is returned ONCE so the user can manually enter it as a
      // fallback to QR scanning. It is stored encrypted on the server.
      secret: result.secret,
      qrCodeDataUrl: result.qrCodeDataUrl,
      recoveryCodes: result.recoveryCodes,
    });
  });
}
