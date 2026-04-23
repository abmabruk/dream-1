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
  PLANNING: "Planning",
  READY: "Ready",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const PROJECT_PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
} as const;

export const PROJECT_TASK_STATUS_LABELS = {
  BACKLOG: "Backlog",
  PLANNED_TODAY: "Planned today",
  IN_PROGRESS: "In progress",
  WAITING_APPROVAL: "Waiting approval",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
} as const;

export const WORK_QUEUE_STATUS_LABELS = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  WAITING_APPROVAL: "Waiting approval",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
} as const;

export const TASK_APPROVAL_STATUS_LABELS = {
  NOT_REQUIRED: "Not required",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;
