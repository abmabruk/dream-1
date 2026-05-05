import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(3).max(160),
  email: z.email().max(160).optional().or(z.literal("")),
  phone: z.string().min(7).max(30).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  district: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  notes: z.string().nullable(),
  orderCount: z.number(),
  createdAt: z.string(),
});

export const customerDetailSchema = customerListItemSchema.extend({
  taxNumber: z.string().nullable(),
  address: z.string().nullable(),
  updatedAt: z.string(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListItem = z.infer<typeof customerListItemSchema>;
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
