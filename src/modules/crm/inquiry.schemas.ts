import { z } from "zod";

import { emptyStringToUndefined } from "@/lib/zod-helpers";

import { INQUIRY_SOURCE_VALUES, INQUIRY_STAGE_VALUES } from "./inquiry-stage";

export const inquiryStageSchema = z.enum(INQUIRY_STAGE_VALUES);
export const inquirySourceSchema = z.enum(INQUIRY_SOURCE_VALUES);

export const createInquirySchema = z.object({
  name: z.string().min(3).max(160),
  phone: z.string().min(7).max(30),
  email: emptyStringToUndefined(z.email().max(160).optional()),
  source: inquirySourceSchema,
  interest: emptyStringToUndefined(z.string().max(200).optional()),
  budgetAmount: z.number().nonnegative().optional(),
  nextFollowUpAt: emptyStringToUndefined(z.string().min(1).optional()),
  notes: emptyStringToUndefined(z.string().max(1000).optional()),
  assignedToId: emptyStringToUndefined(z.string().min(1).optional()),
});

export const updateInquiryStageSchema = z.object({
  inquiryId: z.string().min(1),
  stage: inquiryStageSchema,
  notes: emptyStringToUndefined(z.string().max(1000).optional()),
  nextFollowUpAt: emptyStringToUndefined(z.string().min(1).optional()),
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
  convertedCustomerId: z.string().nullable(),
  convertedOrderId: z.string().nullable(),
  convertedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const ConvertInquiryInput = z.object({
  customerEmail: emptyStringToUndefined(z.string().email().optional()),
  customerPhone: emptyStringToUndefined(z.string().min(8).optional()),
  customerCity: emptyStringToUndefined(z.string().optional()),
  customerDistrict: emptyStringToUndefined(z.string().optional()),
  orderTitle: z.string().min(2).max(200),
  orderDescription: emptyStringToUndefined(z.string().max(2000).optional()),
  orderTargetDate: emptyStringToUndefined(z.string().optional()),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type UpdateInquiryStageInput = z.infer<typeof updateInquiryStageSchema>;
export type InquiryListItem = z.infer<typeof inquiryListItemSchema>;
export type ConvertInquiryInputType = z.infer<typeof ConvertInquiryInput>;
