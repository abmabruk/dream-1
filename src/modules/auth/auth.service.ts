import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getSession } from "@/modules/auth/session";

import { signInSchema, type SignInInput } from "./sign-in.schema";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session-store";
import {
  buildOtpauthUrl,
  buildQrDataUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotp,
} from "./totp";

const TOTP_CHALLENGE_COOKIE = "dream_2fa_challenge";
const CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes

function challengeKey(): Uint8Array {
  const secret = env.AUTH_SECRET || "dev-fallback-secret-not-for-production";
  return new TextEncoder().encode(`${secret}:2fa-challenge`);
}

async function issueChallenge(userId: string): Promise<string> {
  const jwt = await new SignJWT({ uid: userId, kind: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(challengeKey());

  const cookieStore = await cookies();
  cookieStore.set(TOTP_CHALLENGE_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
  return jwt;
}

async function readChallenge(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOTP_CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, challengeKey());
    if (payload.kind !== "2fa" || typeof payload.uid !== "string") return null;
    return payload.uid;
  } catch {
    return null;
  }
}

async function clearChallenge(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOTP_CHALLENGE_COOKIE);
}

export type SignInResult =
  | {
      ok: true;
      requires2fa: false;
      user: {
        id: string;
        email: string;
        role: string;
        factoryName: string;
        displayName: string;
      };
    }
  | {
      ok: true;
      requires2fa: true;
      challengeId: string;
    }
  | { ok: false; message: string };

export class AuthService {
  async signIn(input: SignInInput): Promise<SignInResult> {
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
        ok: false,
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
        ok: false,
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      };
    }

    // If 2FA is enabled, do NOT create a session yet — issue a challenge.
    if (user.totpEnabled && user.totpSecret) {
      const challengeId = await issueChallenge(user.id);
      return { ok: true, requires2fa: true, challengeId };
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
      ok: true,
      requires2fa: false,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        factoryName: user.factory.name,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
      },
    };
  }

  /** Complete a pending 2FA challenge: verify code, create session. */
  async completeSignIn2fa(code: string): Promise<
    | {
        ok: true;
        user: {
          id: string;
          email: string;
          role: string;
          factoryName: string;
          displayName: string;
        };
      }
    | { ok: false; message: string }
  > {
    const userId = await readChallenge();
    if (!userId) {
      return { ok: false, message: "انتهت جلسة التحقق، أعد تسجيل الدخول." };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { factory: true },
    });
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.totpEnabled ||
      !user.totpSecret
    ) {
      await clearChallenge();
      return { ok: false, message: "تعذّر إكمال التحقق." };
    }

    const cleaned = code.replace(/\s+/g, "");
    let verified = false;
    let viaRecovery = false;

    if (/^\d{6}$/.test(cleaned)) {
      const secret = decryptSecret(user.totpSecret);
      verified = verifyTotp(cleaned, secret);
    } else {
      // Try recovery code
      const matchIdx = user.totpRecoveryCodes.findIndex((stored) =>
        verifyRecoveryCode(cleaned, stored),
      );
      if (matchIdx >= 0) {
        verified = true;
        viaRecovery = true;
        // Burn the used code
        const remaining = user.totpRecoveryCodes.filter(
          (_, i) => i !== matchIdx,
        );
        await db.user.update({
          where: { id: user.id },
          data: { totpRecoveryCodes: remaining },
        });
      }
    }

    if (!verified) {
      await recordAudit({
        factoryId: user.factoryId,
        actorUserId: user.id,
        actorRoleSnapshot: user.role,
        action: "AUTH_2FA_FAILED",
        entityType: "User",
        entityId: user.id,
        outcome: "FAILURE",
      });
      return { ok: false, message: "الرمز غير صحيح." };
    }

    await clearChallenge();
    await createSession(user.id);

    await recordAudit({
      factoryId: user.factoryId,
      actorUserId: user.id,
      actorRoleSnapshot: user.role,
      action: viaRecovery ? "AUTH_2FA_RECOVERY_USED" : "AUTH_2FA_VERIFIED",
      entityType: "User",
      entityId: user.id,
    });

    await recordAudit({
      factoryId: user.factoryId,
      actorUserId: user.id,
      actorRoleSnapshot: user.role,
      action: "AUTH_SIGN_IN_SUCCESS",
      entityType: "User",
      entityId: user.id,
      metadata: { via2fa: true, viaRecovery },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        factoryName: user.factory.name,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
      },
    };
  }

  async cancelSignIn2fa() {
    await clearChallenge();
  }

  /** Begin 2FA enrollment: generate secret + QR + recovery codes. */
  async setup2fa(userId: string): Promise<{
    secret: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
  }> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.totpEnabled) {
      throw new Error("2FA already enabled — disable first to re-enroll.");
    }

    const secret = generateTotpSecret();
    const otpauth = buildOtpauthUrl(user.email, secret);
    const qrCodeDataUrl = await buildQrDataUrl(otpauth);
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = recoveryCodes.map((c) => hashRecoveryCode(c));

    // Stash pending (encrypted) secret + hashed recovery codes; only flip
    // totpEnabled=true after the user confirms by entering a valid code.
    await db.user.update({
      where: { id: user.id },
      data: {
        totpSecret: encryptSecret(secret),
        totpRecoveryCodes: hashedCodes,
        totpEnabled: false,
        totpEnabledAt: null,
      },
    });

    return { secret, qrCodeDataUrl, recoveryCodes };
  }

  /** Confirm 2FA enrollment by verifying a freshly generated TOTP code. */
  async confirm2fa(
    userId: string,
    code: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      return { ok: false, message: "ابدأ إعداد المصادقة الثنائية أولاً." };
    }
    if (user.totpEnabled) {
      return { ok: false, message: "المصادقة الثنائية مفعلة بالفعل." };
    }

    const secret = decryptSecret(user.totpSecret);
    const valid = verifyTotp(code, secret);
    if (!valid) return { ok: false, message: "الرمز غير صحيح." };

    await db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpEnabledAt: new Date(),
      },
    });

    await recordAudit({
      factoryId: user.factoryId,
      actorUserId: user.id,
      actorRoleSnapshot: user.role,
      action: "AUTH_2FA_ENABLED",
      entityType: "User",
      entityId: user.id,
    });

    return { ok: true };
  }

  /** Disable 2FA — requires a valid current TOTP code (or recovery code). */
  async disable2fa(
    userId: string,
    code: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return { ok: false, message: "المصادقة الثنائية غير مفعلة." };
    }

    const cleaned = code.replace(/\s+/g, "");
    let valid = false;
    if (/^\d{6}$/.test(cleaned)) {
      const secret = decryptSecret(user.totpSecret);
      valid = verifyTotp(cleaned, secret);
    } else {
      valid = user.totpRecoveryCodes.some((stored) =>
        verifyRecoveryCode(cleaned, stored),
      );
    }

    if (!valid) return { ok: false, message: "الرمز غير صحيح." };

    await db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryCodes: [],
        totpEnabledAt: null,
      },
    });

    await recordAudit({
      factoryId: user.factoryId,
      actorUserId: user.id,
      actorRoleSnapshot: user.role,
      action: "AUTH_2FA_DISABLED",
      entityType: "User",
      entityId: user.id,
    });

    return { ok: true };
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
