import { z } from "zod";

import { emptyStringToUndefined } from "@/lib/zod-helpers";

import { ORDER_STATUS_VALUES } from "./order-status";

export const orderStatusSchema = z.enum(ORDER_STATUS_VALUES);

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(3).max(160),
  description: emptyStringToUndefined(z.string().max(5000).optional()),
  targetDate: emptyStringToUndefined(z.string().min(1).optional()),
  quotedAmount: z.number().nonnegative().optional(),
});

export const orderListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  status: orderStatusSchema,
  customerName: z.string(),
  targetDate: z.string().nullable(),
  quotedAmount: z.number().nullable(),
});

export const orderAssignmentItemSchema = z.object({
  id: z.string(),
  station: z.string(),
  status: z.string(),
  workerId: z.string(),
  workerName: z.string(),
  workerRole: z.string(),
  scheduledFor: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const orderEventItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  actorName: z.string().nullable(),
  fromStatus: orderStatusSchema.nullable(),
  toStatus: orderStatusSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export const orderDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: orderStatusSchema,
  customer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    city: z.string().nullable(),
    district: z.string().nullable(),
  }),
  ownerName: z.string().nullable(),
  createdByName: z.string().nullable(),
  targetDate: z.string().nullable(),
  quotedAmount: z.number().nullable(),
  approvedAt: z.string().nullable(),
  customerApprovedAt: z.string().nullable(),
  customerApprovalNote: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  portalAccess: z
    .object({
      id: z.string(),
      createdAt: z.string(),
      lastViewedAt: z.string().nullable(),
    })
    .nullable(),
  assignments: z.array(orderAssignmentItemSchema),
  events: z.array(orderEventItemSchema),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: orderStatusSchema,
  note: emptyStringToUndefined(z.string().max(1000).optional()),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderListItem = z.infer<typeof orderListItemSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
