import "server-only";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getSession } from "@/modules/auth/session";

import { signInSchema, type SignInInput } from "./sign-in.schema";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session-store";

export class AuthService {
  async signIn(input: SignInInput) {
    const parsed = signInSchema.parse(input);
    const email = parsed.email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email },
      include: { factory: true },
    });

    if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
      await recordAudit({
        factoryId: user?.factoryId ?? null,
        actorUserId: user?.id ?? null,
        actorRoleSnapshot: user?.role ?? null,
        action: "AUTH_SIGN_IN_FAILURE",
        entityType: "User",
        entityId: user?.id ?? null,
        outcome: "FAILURE",
        metadata: {
          email,
          reason: !user ? "unknown_email" : "inactive_or_no_password",
        },
      });
      return {
        ok: false as const,
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      };
    }

    const passwordValid = verifyPassword(parsed.password, user.passwordHash);

    if (!passwordValid) {
      await recordAudit({
        factoryId: user.factoryId,
        actorUserId: user.id,
        actorRoleSnapshot: user.role,
        action: "AUTH_SIGN_IN_FAILURE",
        entityType: "User",
        entityId: user.id,
        outcome: "FAILURE",
        metadata: { email, reason: "bad_password" },
      });
      return {
        ok: false as const,
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      };
    }

    await createSession(user.id);

    await recordAudit({
      factoryId: user.factoryId,
      actorUserId: user.id,
      actorRoleSnapshot: user.role,
      action: "AUTH_SIGN_IN_SUCCESS",
      entityType: "User",
      entityId: user.id,
    });

    return {
      ok: true as const,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        factoryName: user.factory.name,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
      },
    };
  }

  async signOut() {
    const session = await getSession();
    await destroySession();
    if (session) {
      await recordAudit({
        factoryId: session.factoryId,
        actorUserId: session.userId,
        actorRoleSnapshot: session.role,
        action: "AUTH_SIGN_OUT",
        entityType: "User",
        entityId: session.userId,
      });
    }
  }
}
