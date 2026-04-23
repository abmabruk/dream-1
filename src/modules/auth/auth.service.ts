import "server-only";

import { db } from "@/lib/db";

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
      return { ok: false as const, message: "Invalid email or password." };
    }

    const passwordValid = verifyPassword(parsed.password, user.passwordHash);

    if (!passwordValid) {
      return { ok: false as const, message: "Invalid email or password." };
    }

    await createSession(user.id);

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
    await destroySession();
  }
}
