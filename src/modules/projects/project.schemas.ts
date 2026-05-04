import { z } from "zod";

import { emptyStringToUndefined } from "@/lib/zod-helpers";

import {
  PROJECT_PRIORITY_VALUES,
  PROJECT_STATUS_VALUES,
  PROJECT_TASK_STATUS_VALUES,
  TASK_APPROVAL_STATUS_VALUES,
  WORK_QUEUE_STATUS_VALUES,
} from "./project-status";

const boardDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.");

export const projectStatusSchema = z.enum(PROJECT_STATUS_VALUES);
export const projectPrioritySchema = z.enum(PROJECT_PRIORITY_VALUES);
export const projectTaskStatusSchema = z.enum(PROJECT_TASK_STATUS_VALUES);
export const taskApprovalStatusSchema = z.enum(TASK_APPROVAL_STATUS_VALUES);
export const workQueueStatusSchema = z.enum(WORK_QUEUE_STATUS_VALUES);

export const createProjectSchema = z.object({
  orderId: emptyStringToUndefined(z.string().min(1).optional()),
  ownerUserId: emptyStringToUndefined(z.string().min(1).optional()),
  name: z.string().min(3).max(160),
  description: emptyStringToUndefined(z.string().max(4000).optional()),
  priority: projectPrioritySchema.default("MEDIUM"),
  startDate: emptyStringToUndefined(z.string().min(1).optional()),
  dueDate: emptyStringToUndefined(z.string().min(1).optional()),
  notes: emptyStringToUndefined(z.string().max(4000).optional()),
});

export const createProjectTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: emptyStringToUndefined(z.string().max(4000).optional()),
  priority: projectPrioritySchema.default("MEDIUM"),
  assignedToUserId: emptyStringToUndefined(z.string().min(1).optional()),
  dueDate: emptyStringToUndefined(z.string().min(1).optional()),
  requiresApproval: z.boolean().default(false),
  stageInstanceId: emptyStringToUndefined(z.string().min(1).optional()),
  locationId: emptyStringToUndefined(z.string().min(1).optional()),
});

export const updateTaskStageSchema = z.object({
  stageInstanceId: z.string().min(1).nullable(),
});

export const moveTaskToProjectSchema = z.object({
  targetProjectId: z.string().min(1),
  targetStageInstanceId: z.string().min(1).nullable().optional(),
});

export const addTaskToTodaySchema = z.object({
  taskId: z.string().min(1),
  workDate: boardDateSchema,
  assignedToUserId: z.string().min(1).optional(),
  beforeQueueItemId: z.string().min(1).optional(),
  notes: z.string().max(1000).optional(),
});

export const moveQueueItemSchema = z.object({
  queueItemId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export const reorderQueueSchema = z.object({
  workDate: boardDateSchema,
  orderedQueueItemIds: z.array(z.string().min(1)).min(1),
});

export const rescheduleQueueItemSchema = z.object({
  queueItemId: z.string().min(1),
  targetDate: boardDateSchema,
  beforeQueueItemId: z.string().min(1).optional(),
});

export const updateQueueItemSchema = z.object({
  queueItemId: z.string().min(1),
  status: workQueueStatusSchema,
  notes: z.string().max(1000).optional(),
});

export const reviewProjectTaskSchema = z.object({
  taskId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  note: z.string().min(1).max(1000).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: projectTaskStatusSchema,
});

export const opsDateSchema = z.object({
  date: boardDateSchema.optional(),
});

// --- Stage instances ---

export const STAGE_INSTANCE_STATUS_VALUES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "SKIPPED",
] as const;

export const stageInstanceStatusSchema = z.enum(STAGE_INSTANCE_STATUS_VALUES);
export const StageInstanceStatusEnum = stageInstanceStatusSchema;

export const advanceStageInputSchema = z.object({
  stageInstanceId: z.string().min(1),
  note: z.string().max(2000).optional(),
});

export const attestDepositInputSchema = z.object({
  stageInstanceId: z.string().min(1),
  amount: z.number().nonnegative().optional(),
  receivedAt: emptyStringToUndefined(z.string().min(1).optional()),
  method: z
    .enum(["bank_transfer", "cash", "check", "stc_pay", "other"])
    .optional(),
  receiptUrl: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
  drawingsApproved: z.boolean().optional(),
});

// --- Locations ---

export const createLocationInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(160),
  code: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isTemplate: z.boolean().optional(),
  quotedAmount: z.coerce
    .number()
    .nonnegative()
    .max(99999999.99)
    .nullable()
    .optional(),
});

export const updateLocationInputSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(1).max(160).optional(),
  code: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isTemplate: z.boolean().optional(),
  quotedAmount: z.coerce
    .number()
    .nonnegative()
    .max(99999999.99)
    .nullable()
    .optional(),
});

export const updateLocationOnTaskSchema = z.object({
  locationId: z.string().min(1).nullable(),
});

export const cloneLocationInputSchema = z.object({
  count: z.number().int().min(1).max(20).optional(),
  namePrefix: z.string().max(160).optional(),
});

export const reorderLocationsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const createLocationBodySchema = z.object({
  name: z.string().min(1).max(160),
  code: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  isTemplate: z.boolean().optional(),
  quotedAmount: z.coerce
    .number()
    .nonnegative()
    .max(99999999.99)
    .nullable()
    .optional(),
});

export const updateLocationBodySchema = z.object({
  name: z.string().min(1).max(160).optional(),
  code: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isTemplate: z.boolean().optional(),
  quotedAmount: z.coerce
    .number()
    .nonnegative()
    .max(99999999.99)
    .nullable()
    .optional(),
});

export type AdvanceStageInput = z.infer<typeof advanceStageInputSchema>;
export type AttestDepositInput = z.infer<typeof attestDepositInputSchema>;
export type CreateLocationInput = z.infer<typeof createLocationInputSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationInputSchema>;
export type UpdateLocationOnTaskInput = z.infer<
  typeof updateLocationOnTaskSchema
>;
export type CloneLocationInput = z.infer<typeof cloneLocationInputSchema>;
export type ReorderLocationsInput = z.infer<typeof reorderLocationsSchema>;
export type StageInstanceStatusValue = z.infer<
  typeof stageInstanceStatusSchema
>;

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;
export type UpdateTaskStageInput = z.infer<typeof updateTaskStageSchema>;
export type MoveTaskToProjectInput = z.infer<typeof moveTaskToProjectSchema>;
export type AddTaskToTodayInput = z.infer<typeof addTaskToTodaySchema>;
export type MoveQueueItemInput = z.infer<typeof moveQueueItemSchema>;
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;
export type RescheduleQueueItemInput = z.infer<
  typeof rescheduleQueueItemSchema
>;
export type UpdateQueueItemInput = z.infer<typeof updateQueueItemSchema>;
export type ReviewProjectTaskInput = z.infer<typeof reviewProjectTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  status: z.infer<typeof projectStatusSchema>;
  priority: z.infer<typeof projectPrioritySchema>;
  dueDate: string | null;
  ownerName: string | null;
  orderCode: string | null;
  openTaskCount: number;
  queuedTodayCount: number;
  waitingApprovalCount: number;
  doneTaskCount: number;
  totalTaskCount: number;
};

export type ProjectTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: z.infer<typeof projectTaskStatusSchema>;
  priority: z.infer<typeof projectPrioritySchema>;
  requiresApproval: boolean;
  approvalStatus: z.infer<typeof taskApprovalStatusSchema>;
  dueDate: string | null;
  completedAt: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  approvedByName: string | null;
  rejectedReason: string | null;
  sortOrder: number;
  updatedAt: string;
  stageInstanceId: string | null;
  stageName: string | null;
  locationId: string | null;
  locationName: string | null;
  locationCode: string | null;
  todayQueueItem: {
    id: string;
    status: z.infer<typeof workQueueStatusSchema>;
    position: number;
    assignedToName: string | null;
    notes: string | null;
  } | null;
};

export type StageInstanceItem = {
  id: string;
  stageId: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: StageInstanceStatusValue;
  isOptional: boolean;
  requiresDepositAttestation: boolean;
  expectedDays: number | null;
  startedAt: string | null;
  completedAt: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  notes: string | null;
  depositAttested: boolean;
  depositAmount: number | null;
  depositReceivedAt: string | null;
  depositMethod: string | null;
  depositReceiptUrl: string | null;
  depositNote: string | null;
  drawingsApproved: boolean;
};

export type StageInstanceDetail = StageInstanceItem & {
  projectId: string;
  factoryId: string;
};

export type LocationItem = {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  sortOrder: number;
  isTemplate: boolean;
  taskCount: number;
  quotedAmount: number | null;
  totalCost: number;
  profitLoss: number | null;
};

export type ProjectDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: z.infer<typeof projectStatusSchema>;
  priority: z.infer<typeof projectPrioritySchema>;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  ownerName: string | null;
  orderCode: string | null;
  orderId: string | null;
  customerId: string | null;
  customerName: string | null;
  inquiryId: string | null;
  tasks: ProjectTaskItem[];
  stageInstances: StageInstanceItem[];
  currentStageInstance: StageInstanceItem | null;
  locations: LocationItem[];
  activities: {
    id: string;
    type: string;
    message: string;
    actorName: string | null;
    createdAt: string;
    stageInstanceId: string | null;
  }[];
};

export type OpsBoardData = {
  date: string;
  summary: {
    total: number;
    overdue: number;
    waitingApproval: number;
    blocked: number;
    done: number;
  };
  queue: {
    id: string;
    position: number;
    status: z.infer<typeof workQueueStatusSchema>;
    notes: string | null;
    assignedToName: string | null;
    assignedToUserId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    task: {
      id: string;
      title: string;
      description: string | null;
      priority: z.infer<typeof projectPrioritySchema>;
      requiresApproval: boolean;
      approvalStatus: z.infer<typeof taskApprovalStatusSchema>;
      projectId: string;
      projectCode: string;
      projectName: string;
      updatedAt: string;
    };
  }[];
  projects: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    ownerName: string | null;
    dueDate: string | null;
    status: z.infer<typeof projectStatusSchema>;
    todayCount: number;
    backlogCount: number;
    waitingApprovalCount: number;
  }[];
  forgottenTasks: {
    id: string;
    title: string;
    dueDate: string | null;
    projectId: string;
    projectCode: string;
    projectName: string;
    assignedToName: string | null;
  }[];
};
