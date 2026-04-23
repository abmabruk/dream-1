import { z } from "zod";

import { ASSIGNMENT_STATUS_VALUES } from "./assignment-status";

export const createAssignmentSchema = z.object({
  orderId: z.string().min(1),
  workerId: z.string().min(1),
  station: z.string().min(2).max(100),
  scheduledFor: z.string().min(1).optional(),
  notes: z.string().max(1000).optional(),
});

export const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUS_VALUES);

export const updateAssignmentStatusSchema = z.object({
  assignmentId: z.string().min(1),
  status: assignmentStatusSchema,
  note: z.string().max(1000).optional(),
});

export const workerAssignmentItemSchema = z.object({
  id: z.string(),
  station: z.string(),
  status: assignmentStatusSchema,
  scheduledFor: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  order: z.object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    status: z.string(),
    customerName: z.string(),
  }),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;
export type WorkerAssignmentItem = z.infer<typeof workerAssignmentItemSchema>;
