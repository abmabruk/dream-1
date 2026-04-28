export const ASSIGNMENT_STATUS_VALUES = [
  "PLANNED",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
] as const;

export type AssignmentWorkflowStatus = (typeof ASSIGNMENT_STATUS_VALUES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<
  AssignmentWorkflowStatus,
  string
> = {
  PLANNED: "مخطط",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متوقف",
  DONE: "منجز",
};

export const ASSIGNMENT_STATUS_TRANSITIONS: Record<
  AssignmentWorkflowStatus,
  AssignmentWorkflowStatus[]
> = {
  PLANNED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS", "DONE"],
  DONE: [],
};
