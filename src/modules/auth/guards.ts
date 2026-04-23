import "server-only";

import { redirect } from "next/navigation";

import { hasPermission, type Permission } from "./roles";
import { requireSession } from "./session";

export async function requirePermission(permission: Permission) {
  const session = await requireSession();

  if (!hasPermission(session.role, permission)) {
    redirect("/forbidden");
  }

  return session;
}
