import "server-only";

import type { AuditOutcome } from "@prisma/client";

import { db } from "@/lib/db";

export type AuditAction =
  | "AUTH_SIGN_IN_SUCCESS"
  | "AUTH_SIGN_IN_FAILURE"
  | "AUTH_SIGN_OUT"
  | "AUTH_PASSWORD_RESET_REQUESTED"
  | "AUTH_PASSWORD_CHANGED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DISABLED"
  | "USER_ROLE_CHANGED"
  | "PORTAL_LINK_CREATED"
  | "PORTAL_LINK_REVOKED"
  | "COST_CREATED"
  | "COST_UPDATED"
  | "COST_DELETED"
  | "QUOTE_APPROVED"
  | "QUOTE_REJECTED"
  | "QUOTE_CANCELLED"
  | "QUOTE_SENT"
  | "INVOICE_SENT"
  | "INVOICE_VOIDED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_DELETED"
  | "PERMISSION_DENIED";

export interface AuditEntry {
  factoryId?: string | null;
  actorUserId?: string | null;
  actorRoleSnapshot?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  outcome?: AuditOutcome;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log a security-sensitive action. Best-effort — never throws.
 * Failures are swallowed to avoid breaking the main request flow.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        factoryId: entry.factoryId ?? null,
        actorUserId: entry.actorUserId ?? null,
        actorRoleSnapshot: entry.actorRoleSnapshot ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        outcome: entry.outcome ?? "SUCCESS",
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId ?? null,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
      },
    });
  } catch (err) {
    // Don't let audit failures break user actions.
    // In production this should ship to a fallback log (Sentry, file).
    console.error("[audit] failed to record entry", entry.action, err);
  }
}

/** Extract IP + UA + requestId from a Request for convenience. */
export function auditContextFromRequest(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
} {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const requestId =
    req.headers.get("x-request-id") ?? req.headers.get("x-vercel-id") ?? null;
  return { ipAddress, userAgent, requestId };
}
