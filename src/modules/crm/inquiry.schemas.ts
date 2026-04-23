import { z } from "zod";

import { INQUIRY_SOURCE_VALUES, INQUIRY_STAGE_VALUES } from "./inquiry-stage";

export const inquiryStageSchema = z.enum(INQUIRY_STAGE_VALUES);
export const inquirySourceSchema = z.enum(INQUIRY_SOURCE_VALUES);

export const createInquirySchema = z.object({
  name: z.string().min(3).max(160),
  phone: z.string().min(7).max(30),
  email: z.email().max(160).optional().or(z.literal("")),
  source: inquirySourceSchema,
  interest: z.string().max(200).optional().or(z.literal("")),
  budgetAmount: z.number().nonnegative().optional(),
  nextFollowUpAt: z.string().min(1).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  assignedToId: z.string().min(1).optional().or(z.literal("")),
});

export const updateInquiryStageSchema = z.object({
  inquiryId: z.string().min(1),
  stage: inquiryStageSchema,
  notes: z.string().max(1000).optional().or(z.literal("")),
  nextFollowUpAt: z.string().min(1).optional().or(z.literal("")),
});

export const inquiryListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  source: inquirySourceSchema,
  stage: inquiryStageSchema,
  interest: z.string().nullable(),
  budgetAmount: z.number().nullable(),
  nextFollowUpAt: z.string().nullable(),
  notes: z.string().nullable(),
  assignedToName: z.string().nullable(),
  createdAt: z.string(),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type UpdateInquiryStageInput = z.infer<typeof updateInquiryStageSchema>;
export type InquiryListItem = z.infer<typeof inquiryListItemSchema>;
