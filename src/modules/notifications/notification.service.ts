import "server-only";

import { cache } from "react";

import { HttpError } from "@/lib/http/http-error";
import { hasPermission, type UserRole } from "@/modules/auth/roles";
import { INQUIRY_STAGE_LABELS } from "@/modules/crm/inquiry-stage";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order-status";

import { ASSIGNMENT_STATUS_LABELS } from "../production/assignment-status";
import { NotificationRepository } from "./notification.repository";
import type {
  NotificationDraft,
  NotificationFeed,
  NotificationListItem,
  NotificationType,
} from "./notification.schemas";

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "لا يوجد تاريخ";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function differenceInDays(from: Date, to: Date) {
  const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / ONE_DAY_IN_MS));
}

function buildSummary(items: NotificationListItem[]) {
  const unread = items.filter((item) => item.status === "UNREAD");
  const read = items.filter((item) => item.status === "READ");

  const countByType = (type: NotificationType) =>
    items.filter((item) => item.type === type).length;

  return {
    totalActive: items.length,
    unread: unread.length,
    read: read.length,
    overdueOrders: countByType("ORDER_OVERDUE"),
    dueFollowUps: countByType("CRM_FOLLOW_UP_DUE"),
    blockedAssignments: countByType("ASSIGNMENT_BLOCKED"),
    pendingApprovals: countByType("CUSTOMER_APPROVAL_PENDING"),
  };
}

export class NotificationService {
  constructor(private readonly repository = new NotificationRepository()) {}

  async getFeed(input: {
    factoryId: string;
    userId: string;
    role: UserRole;
  }): Promise<NotificationFeed> {
    const drafts = await this.buildDrafts(input);

    await this.repository.syncForUser(input.factoryId, input.userId, drafts);

    const active = await this.repository.listActiveByUser(input.factoryId, input.userId);

    return {
      summary: buildSummary(active),
      unread: active.filter((item) => item.status === "UNREAD"),
      read: active.filter((item) => item.status === "READ"),
    };
  }

  async getUnreadCount(input: {
    factoryId: string;
    userId: string;
    role: UserRole;
  }) {
    const feed = await this.getFeed(input);
    return feed.summary.unread;
  }

  async markRead(factoryId: string, userId: string, notificationId: string) {
    const result = await this.repository.markRead(factoryId, userId, notificationId);

    if (result.count === 0) {
      throw new HttpError(404, "Notification not found.");
    }

    return result;
  }

  async markAllRead(factoryId: string, userId: string) {
    return this.repository.markAllRead(factoryId, userId);
  }

  private async buildDrafts(input: {
    factoryId: string;
    role: UserRole;
  }): Promise<NotificationDraft[]> {
    const drafts: NotificationDraft[] = [];
    const now = new Date();
    const canViewOrders = hasPermission(input.role, "orders:view");
    const canViewCrm = hasPermission(input.role, "crm:view");
    const canViewProduction = hasPermission(input.role, "production:view");
    const canTrackApprovals =
      hasPermission(input.role, "portal:view") ||
      hasPermission(input.role, "orders:update");

    const [overdueOrders, dueFollowUps, blockedAssignments, pendingApprovals] =
      await Promise.all([
        canViewOrders
          ? this.repository.listOverdueOrders(input.factoryId)
          : Promise.resolve([]),
        canViewCrm
          ? this.repository.listDueFollowUps(input.factoryId)
          : Promise.resolve([]),
        canViewProduction
          ? this.repository.listBlockedAssignments(input.factoryId)
          : Promise.resolve([]),
        canTrackApprovals
          ? this.repository.listPendingApprovals(input.factoryId)
          : Promise.resolve([]),
      ]);

    for (const order of overdueOrders) {
      const daysLate = differenceInDays(order.targetDate ?? now, now);
      drafts.push({
        dedupeKey: `ORDER_OVERDUE:${order.id}`,
        type: "ORDER_OVERDUE",
        title: `الطلب ${order.code} متأخر`,
        message: `${order.title} للعميل ${order.customer.name} متأخر ${daysLate} ${daysLate === 1 ? "يوم" : "أيام"} ولا يزال في حالة ${ORDER_STATUS_LABELS[order.status]}.`,
        href: `/app/orders/${order.id}`,
        entityType: "ORDER",
        entityId: order.id,
      });
    }

    for (const inquiry of dueFollowUps) {
      const assigneeName = inquiry.assignedTo
        ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}`.trim()
        : "غير معين";

      drafts.push({
        dedupeKey: `CRM_FOLLOW_UP_DUE:${inquiry.id}`,
        type: "CRM_FOLLOW_UP_DUE",
        title: `موعد متابعة ${inquiry.name}`,
        message: `استفسار ${INQUIRY_STAGE_LABELS[inquiry.stage]} مع ${assigneeName} كان مستحقاً بتاريخ ${formatDate(inquiry.nextFollowUpAt)}.`,
        href: `/app/crm#inquiry-${inquiry.id}`,
        entityType: "INQUIRY",
        entityId: inquiry.id,
      });
    }

    for (const assignment of blockedAssignments) {
      const workerName = `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim();

      drafts.push({
        dedupeKey: `ASSIGNMENT_BLOCKED:${assignment.id}`,
        type: "ASSIGNMENT_BLOCKED",
        title: `مهمة متوقفة في ${assignment.station}`,
        message: `${workerName} لديه مهمة ${ASSIGNMENT_STATUS_LABELS[assignment.status]} في الطلب ${assignment.order.code} للعميل ${assignment.order.customer.name}.`,
        href: `/app/orders/${assignment.orderId}`,
        entityType: "ASSIGNMENT",
        entityId: assignment.id,
      });
    }

    for (const order of pendingApprovals) {
      drafts.push({
        dedupeKey: `CUSTOMER_APPROVAL_PENDING:${order.id}`,
        type: "CUSTOMER_APPROVAL_PENDING",
        title: `بانتظار موافقة العميل على ${order.code}`,
        message: `${order.customer.name} لم يوافق على هذا الطلب منذ ${formatDate(order.portalAccess?.createdAt)}.`,
        href: `/app/orders/${order.id}`,
        entityType: "ORDER",
        entityId: order.id,
      });
    }

    return drafts;
  }
}

const notificationService = new NotificationService();

export const getNotificationFeedCached = cache(
  async (factoryId: string, userId: string, role: UserRole) =>
    notificationService.getFeed({ factoryId, userId, role })
);
