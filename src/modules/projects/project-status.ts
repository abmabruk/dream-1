import { WorkQueueStatus } from "@prisma/client";

export const PROJECT_STATUS_VALUES = [
  "PLANNING",
  "READY",
  "IN_PROGRESS",
  "ON_HOLD",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const PROJECT_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const PROJECT_TASK_STATUS_VALUES = [
  "BACKLOG",
  "PLANNED_TODAY",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

export const WORK_QUEUE_STATUS_VALUES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

export const TASK_APPROVAL_STATUS_VALUES = [
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const PROJECT_STATUS_LABELS = {
  PLANNING: "تخطيط",
  READY: "جاهز",
  IN_PROGRESS: "قيد التنفيذ",
  ON_HOLD: "معلق",
  BLOCKED: "متوقف",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
} as const;

export const PROJECT_PRIORITY_LABELS = {
  LOW: "منخفض",
  MEDIUM: "متوسط",
  HIGH: "عالي",
  URGENT: "عاجل",
} as const;

export const PROJECT_TASK_STATUS_LABELS = {
  BACKLOG: "للتنفيذ",
  PLANNED_TODAY: "مخطط اليوم",
  IN_PROGRESS: "قيد التنفيذ",
  WAITING_APPROVAL: "بانتظار الموافقة",
  BLOCKED: "متوقف",
  DONE: "منجز",
  CANCELLED: "ملغي",
} as const;

export const WORK_QUEUE_STATUS_LABELS = {
  PLANNED: "مخطط",
  IN_PROGRESS: "قيد التنفيذ",
  WAITING_APPROVAL: "بانتظار الموافقة",
  BLOCKED: "متوقف",
  DONE: "منجز",
  CANCELLED: "ملغي",
} as const;

export const TASK_APPROVAL_STATUS_LABELS = {
  NOT_REQUIRED: "غير مطلوب",
  PENDING: "قيد الانتظار",
  APPROVED: "موافق عليه",
  REJECTED: "مرفوض",
} as const;

export const WORK_QUEUE_STATUS_TRANSITIONS: Record<WorkQueueStatus, WorkQueueStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_APPROVAL", "BLOCKED", "DONE", "PLANNED"],
  WAITING_APPROVAL: ["IN_PROGRESS", "DONE", "BLOCKED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};
