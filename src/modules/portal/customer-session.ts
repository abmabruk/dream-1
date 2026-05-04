import "server-only";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession, type AppSession } from "@/modules/auth/session";

export type CustomerPortalSession = {
  session: AppSession;
  customer: {
    id: string;
    factoryId: string;
    name: string;
    email: string | null;
  };
  factory: {
    id: string;
    name: string;
    portalDisplayName: string | null;
    currency: string;
  };
};

/**
 * Require a logged-in CUSTOMER user with a linked Customer row, and
 * return both. Redirects to /portal/login when missing/invalid.
 */
export async function requireCustomerPortalSession(): Promise<CustomerPortalSession> {
  const session = await getSession();
  if (!session) {
    redirect("/portal/login");
  }
  if (session.role !== "CUSTOMER") {
    // Internal users belong in /app; bounce them.
    redirect("/app");
  }

  const customer = await db.customer.findFirst({
    where: { userId: session.userId, factoryId: session.factoryId },
    select: {
      id: true,
      factoryId: true,
      name: true,
      email: true,
      factory: {
        select: {
          id: true,
          name: true,
          portalDisplayName: true,
          currency: true,
        },
      },
    },
  });

  if (!customer) {
    // Authenticated but not linked — treat as forbidden access to the portal.
    redirect("/forbidden");
  }

  return {
    session,
    customer: {
      id: customer.id,
      factoryId: customer.factoryId,
      name: customer.name,
      email: customer.email,
    },
    factory: customer.factory,
  };
}
