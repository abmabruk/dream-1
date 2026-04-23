import { z } from "zod";

import { USER_ROLES } from "@/modules/auth/roles";
import {
  INTERNAL_USER_ROLES,
  MANAGEABLE_USER_STATUSES,
  USER_STATUS_VALUES,
} from "./user-access";

export const userRoleSchema = z.enum(USER_ROLES);
export const userStatusSchema = z.enum(USER_STATUS_VALUES);

export const userListItemSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
  phone: z.string().nullable(),
  createdAt: z.string(),
});

export const assignableWorkerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: userRoleSchema,
});

export const createManagedUserSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.email().transform((value) => value.toLowerCase().trim()),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.enum(INTERNAL_USER_ROLES),
  password: z.string().min(8).max(100),
});

export const updateManagedUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(INTERNAL_USER_ROLES),
  status: z.enum(MANAGEABLE_USER_STATUSES),
});

export const resetManagedUserPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(100),
});

export type UserListItem = z.infer<typeof userListItemSchema>;
export type AssignableWorker = z.infer<typeof assignableWorkerSchema>;
export type CreateManagedUserInput = z.infer<typeof createManagedUserSchema>;
export type UpdateManagedUserInput = z.infer<typeof updateManagedUserSchema>;
export type ResetManagedUserPasswordInput = z.infer<
  typeof resetManagedUserPasswordSchema
>;
