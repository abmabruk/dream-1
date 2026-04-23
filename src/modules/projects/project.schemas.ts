import { z } from "zod";

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
  orderId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  name: z.string().min(3).max(160),
  description: z.string().max(4000).optional(),
  priority: projectPrioritySchema.default("MEDIUM"),
  startDate: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  notes: z.string().max(4000).optional(),
});

export const createProjectTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  priority: projectPrioritySchema.default("MEDIUM"),
  assignedToUserId: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  requiresApproval: z.boolean().default(false),
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

export const opsDateSchema = z.object({
  date: boardDateSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;
export type AddTaskToTodayInput = z.infer<typeof addTaskToTodaySchema>;
export type MoveQueueItemInput = z.infer<typeof moveQueueItemSchema>;
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;
export type RescheduleQueueItemInput = z.infer<typeof rescheduleQueueItemSchema>;
export type UpdateQueueItemInput = z.infer<typeof updateQueueItemSchema>;
export type ReviewProjectTaskInput = z.infer<typeof reviewProjectTaskSchema>;

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
  todayQueueItem: {
    id: string;
    status: z.infer<typeof workQueueStatusSchema>;
    position: number;
    assignedToName: string | null;
    notes: string | null;
  } | null;
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
  tasks: ProjectTaskItem[];
  activities: {
    id: string;
    type: string;
    message: string;
    actorName: string | null;
    createdAt: string;
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
