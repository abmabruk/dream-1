import { recordAudit } from "@/lib/audit";
import { fail } from "@/lib/http/api-response";
import { hasPermission, type Permission } from "./roles";
import { getSession } from "./session";

export async function requireApiPermission(permission: Permission) {
  const session = await getSession();

  if (!session) {
    return {
      ok: false as const,
      response: fail("Authentication required", 401),
    };
  }

  if (!hasPermission(session.role, permission)) {
    await recordAudit({
      factoryId: session.factoryId,
      actorUserId: session.userId,
      actorRoleSnapshot: session.role,
      action: "PERMISSION_DENIED",
      outcome: "FAILURE",
      metadata: { permission },
    });
    return {
      ok: false as const,
      response: fail("Forbidden", 403),
    };
  }

  return {
    ok: true as const,
    session,
  };
}
