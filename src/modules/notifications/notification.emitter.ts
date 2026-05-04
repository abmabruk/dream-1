import "server-only";

import { type UserRole } from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";

import type { NotificationType } from "./notification.schemas";

export interface EmitNotificationInput {
  factoryId: string;
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  title: string;
  message: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

type DbLike = typeof db | PrismaTransaction;

/**
 * Fire-and-forget emit with internal try/catch — caller actions never fail
 * because of a notification write error. Pass `tx` to enlist in the caller's
 * transaction (recommended when you want notifications to roll back with the
 * action), or omit to write best-effort outside the transaction.
 */
export async function emitNotification(
  input: EmitNotificationInput,
  client: DbLike = db,
): Promise<void> {
  try {
    await client.notification.upsert({
      where: {
        userId_dedupeKey: {
          userId: input.userId,
          dedupeKey: input.dedupeKey,
        },
      },
      create: {
        factoryId: input.factoryId,
        userId: input.userId,
        type: input.type,
        dedupeKey: input.dedupeKey,
        title: input.title,
        message: input.message,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      update: {
        type: input.type,
        title: input.title,
        message: input.message,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        // Re-open if previously resolved
        resolvedAt: null,
      },
    });
  } catch (err) {
    // Never crash the caller — log and continue.
     
    console.error("[emitNotification] failed", {
      type: input.type,
      dedupeKey: input.dedupeKey,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function emitNotifications(
  inputs: EmitNotificationInput[],
  client: DbLike = db,
): Promise<void> {
  await Promise.all(inputs.map((i) => emitNotification(i, client)));
}

/**
 * Returns active users in a factory matching the given role(s).
 */
export async function findFactoryUsersByRole(
  factoryId: string,
  roles: UserRole | UserRole[],
  client: DbLike = db,
): Promise<Array<{ id: string }>> {
  const roleList = Array.isArray(roles) ? roles : [roles];
  return client.user.findMany({
    where: {
      factoryId,
      status: "ACTIVE",
      role: { in: roleList },
    },
    select: { id: true },
  });
}
