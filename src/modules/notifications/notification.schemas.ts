import { z } from "zod";

export const NOTIFICATION_STATUS_VALUES = ["UNREAD", "READ"] as const;
export const NOTIFICATION_TYPE_VALUES = [
  "ORDER_OVERDUE",
  "CRM_FOLLOW_UP_DUE",
  "ASSIGNMENT_BLOCKED",
  "CUSTOMER_APPROVAL_PENDING",
  "TASK_MENTIONED",
  "TASK_COMMENT",
  "STAGE_STARTED",
  "DEPOSIT_ATTESTED",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUS_VALUES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ORDER_OVERDUE: "الطلب متأخر",
  CRM_FOLLOW_UP_DUE: "موعد المتابعة",
  ASSIGNMENT_BLOCKED: "المهمة متوقفة",
  CUSTOMER_APPROVAL_PENDING: "بانتظار موافقة العميل",
  TASK_MENTIONED: "تم ذكرك",
  TASK_COMMENT: "تعليق جديد",
  STAGE_STARTED: "بدأت مرحلة جديدة",
  DEPOSIT_ATTESTED: "تم تأكيد العربون",
};

export const notificationListItemSchema = z.object({
  id: z.string(),
  type: z.enum(NOTIFICATION_TYPE_VALUES),
  status: z.enum(NOTIFICATION_STATUS_VALUES),
  title: z.string(),
  message: z.string(),
  href: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  readAt: z.string().nullable(),
});

export const notificationDraftSchema = z.object({
  dedupeKey: z.string().min(1),
  type: z.enum(NOTIFICATION_TYPE_VALUES),
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(280),
  href: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export const notificationFeedSchema = z.object({
  summary: z.object({
    totalActive: z.number().nonnegative(),
    unread: z.number().nonnegative(),
    read: z.number().nonnegative(),
    overdueOrders: z.number().nonnegative(),
    dueFollowUps: z.number().nonnegative(),
    blockedAssignments: z.number().nonnegative(),
    pendingApprovals: z.number().nonnegative(),
  }),
  unread: z.array(notificationListItemSchema),
  read: z.array(notificationListItemSchema),
});

export type NotificationListItem = z.infer<typeof notificationListItemSchema>;
export type NotificationDraft = z.infer<typeof notificationDraftSchema>;
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;
