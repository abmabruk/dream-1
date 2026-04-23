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
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
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
