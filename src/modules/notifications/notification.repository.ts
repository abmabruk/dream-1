import "server-only";

import {
  AssignmentStatus,
  NotificationStatus,
  OrderStatus,
} from "@prisma/client";

import { db } from "@/lib/db";
import { OPEN_INQUIRY_STAGE_VALUES } from "@/modules/crm/inquiry-stage";
import { INCOMPLETE_ORDER_STATUS_VALUES } from "@/modules/orders/order-status";

import type {
  NotificationDraft,
  NotificationListItem,
  NotificationType,
} from "./notification.schemas";

function toNotificationListItem(notification: {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  updatedAt: Date;
  readAt: Date | null;
}) {
  return {
    id: notification.id,
    type: notification.type,
    status: notification.status,
    title: notification.title,
    message: notification.message,
    href: notification.href,
    entityType: notification.entityType,
    entityId: notification.entityId,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  } as NotificationListItem;
}

export class NotificationRepository {
  async listOverdueOrders(factoryId: string) {
    return db.order.findMany({
      where: {
        factoryId,
        status: {
          in: [...INCOMPLETE_ORDER_STATUS_VALUES] as OrderStatus[],
        },
        targetDate: {
          lt: new Date(),
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }],
    });
  }

  async listDueFollowUps(factoryId: string) {
    return db.inquiry.findMany({
      where: {
        factoryId,
        stage: {
          in: [...OPEN_INQUIRY_STAGE_VALUES],
        },
        nextFollowUpAt: {
          lte: new Date(),
        },
      },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "asc" }],
    });
  }

  async listBlockedAssignments(factoryId: string) {
    return db.assignment.findMany({
      where: {
        factoryId,
        status: AssignmentStatus.BLOCKED,
      },
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        order: {
          include: {
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async listPendingApprovals(factoryId: string) {
    return db.order.findMany({
      where: {
        factoryId,
        status: OrderStatus.QUOTED,
        customerApprovedAt: null,
        portalAccess: {
          isNot: null,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        portalAccess: {
          select: {
            createdAt: true,
            lastViewedAt: true,
          },
        },
      },
      orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    });
  }

  async syncForUser(
    factoryId: string,
    userId: string,
    drafts: NotificationDraft[],
  ) {
    const activeKeys = drafts.map((draft) => draft.dedupeKey);
    // Only auto-resolve notifications whose `type` is among those that
    // buildDrafts() manages (i.e. recomputed from current state on every
    // sync). Persistent business-event notifications (INVOICE_PAID,
    // QUOTE_APPROVED, PAYMENT_RECEIVED, etc.) are written by emitters
    // and should NOT be touched here — otherwise they get auto-resolved
    // on the very next /api/v1/notifications GET.
    const MANAGED_DRAFT_TYPES = [
      "ORDER_OVERDUE",
      "CRM_FOLLOW_UP_DUE",
      "ASSIGNMENT_BLOCKED",
      "CUSTOMER_APPROVAL_PENDING",
    ];
    const [matchingRecords, unresolvedRecords] = await Promise.all([
      activeKeys.length === 0
        ? Promise.resolve([])
        : db.notification.findMany({
            where: {
              factoryId,
              userId,
              dedupeKey: {
                in: activeKeys,
              },
            },
          }),
      db.notification.findMany({
        where: {
          factoryId,
          userId,
          resolvedAt: null,
          type: { in: MANAGED_DRAFT_TYPES as never },
        },
        select: {
          id: true,
          dedupeKey: true,
        },
      }),
    ]);

    const matchingByKey = new Map(
      matchingRecords.map((notification) => [
        notification.dedupeKey,
        notification,
      ]),
    );
    const now = new Date();

    await db.$transaction(async (tx) => {
      for (const draft of drafts) {
        const existing = matchingByKey.get(draft.dedupeKey);

        if (!existing) {
          await tx.notification.create({
            data: {
              factoryId,
              userId,
              dedupeKey: draft.dedupeKey,
              type: draft.type as never,
              title: draft.title,
              message: draft.message,
              href: draft.href ?? null,
              entityType: draft.entityType ?? null,
              entityId: draft.entityId ?? null,
            },
          });
          continue;
        }

        await tx.notification.update({
          where: {
            id: existing.id,
          },
          data: {
            type: draft.type as never,
            title: draft.title,
            message: draft.message,
            href: draft.href ?? null,
            entityType: draft.entityType ?? null,
            entityId: draft.entityId ?? null,
            resolvedAt: null,
            status:
              existing.resolvedAt != null
                ? NotificationStatus.UNREAD
                : existing.status,
            readAt: existing.resolvedAt != null ? null : existing.readAt,
          },
        });
      }

      const staleIds = unresolvedRecords
        .filter((notification) => !activeKeys.includes(notification.dedupeKey))
        .map((notification) => notification.id);

      if (staleIds.length > 0) {
        await tx.notification.updateMany({
          where: {
            id: {
              in: staleIds,
            },
          },
          data: {
            resolvedAt: now,
          },
        });
      }
    });
  }

  async listActiveByUser(
    factoryId: string,
    userId: string,
  ): Promise<NotificationListItem[]> {
    const notifications = await db.notification.findMany({
      where: {
        factoryId,
        userId,
        resolvedAt: null,
      },
      orderBy: [
        { status: "asc" },
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    return notifications.map(toNotificationListItem);
  }

  async countUnread(factoryId: string, userId: string) {
    return db.notification.count({
      where: {
        factoryId,
        userId,
        resolvedAt: null,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  async markRead(factoryId: string, userId: string, notificationId: string) {
    return db.notification.updateMany({
      where: {
        id: notificationId,
        factoryId,
        userId,
        resolvedAt: null,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async markAllRead(factoryId: string, userId: string) {
    return db.notification.updateMany({
      where: {
        factoryId,
        userId,
        resolvedAt: null,
        status: NotificationStatus.UNREAD,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }
}
