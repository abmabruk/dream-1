import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import type { UserRole } from "./roles";
import { hashSessionToken, SESSION_COOKIE } from "./session-store";

export type AppSession = {
  userId: string;
  factoryId: string;
  factoryName: string;
  factoryCurrency: string;
  factoryTimezone: string;
  role: UserRole;
  email: string;
  displayName: string;
};

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await db.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      expiresAt: {
        gt: new Date(),
      },
      user: {
        status: "ACTIVE",
      },
    },
    include: {
      user: {
        include: {
          factory: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  return {
    userId: session.userId,
    factoryId: session.user.factoryId,
    factoryName: session.user.factory.name,
    factoryCurrency: session.user.factory.currency,
    factoryTimezone: session.user.factory.timezone,
    role: session.user.role,
    email: session.user.email,
    displayName: `${session.user.firstName} ${session.user.lastName}`.trim(),
  };
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}
