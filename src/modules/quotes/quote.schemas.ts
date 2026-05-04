import { z } from "zod";

export const QUOTE_STATUS_VALUES = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "SUPERSEDED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;

export const QuoteStatusEnum = z.enum(QUOTE_STATUS_VALUES);
export type QuoteStatus = z.infer<typeof QuoteStatusEnum>;

export const QUOTE_STATUS_LABELS_AR: Record<QuoteStatus, string> = {
  DRAFT: "مسودة",
  SENT: "مُرسَل",
  APPROVED: "معتمد",
  SUPERSEDED: "مستبدل",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
  EXPIRED: "منتهي الصلاحية",
};

/**
 * A single line on a quote. Money values are coerced to numbers from
 * strings/numbers — service code converts them to Prisma.Decimal via
 * src/lib/money.ts before persisting.
 */
export const QuoteLineInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().max(99999999.9999),
  unitPrice: z.coerce.number().nonnegative().max(99999999.9999),
  productId: z.string().min(1).nullable().optional(),
  sku: z.string().max(120).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});
export type QuoteLineInputType = z.infer<typeof QuoteLineInput>;

export const CreateQuoteInput = z.object({
  orderId: z.string().min(1),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  validUntil: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  discountAmount: z.coerce.number().nonnegative().max(99999999.99).optional(),
  discountReason: z.string().max(500).nullable().optional(),
  lines: z.array(QuoteLineInput).default([]),
});
export type CreateQuoteInputType = z.infer<typeof CreateQuoteInput>;

/**
 * Updates may modify everything *except* the immutable orderId. The
 * service layer additionally enforces that only DRAFT quotes can be edited.
 * `expectedUpdatedAt` enables optimistic concurrency control.
 */
export const UpdateQuoteInput = z.object({
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  validUntil: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  discountAmount: z.coerce.number().nonnegative().max(99999999.99).optional(),
  discountReason: z.string().max(500).nullable().optional(),
  lines: z.array(QuoteLineInput).optional(),
  expectedUpdatedAt: z.string().min(1).optional(),
});
export type UpdateQuoteInputType = z.infer<typeof UpdateQuoteInput>;

export type QuoteLineDetail = {
  id: string;
  quoteId: string;
  sortOrder: number;
  productId: string | null;
  description: string;
  sku: string | null;
  /** serialized Decimal(14,4) */
  quantity: string;
  /** serialized Decimal(14,4) */
  unitPrice: string;
  /** serialized Decimal(14,2) */
  lineTotal: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteListItem = {
  id: string;
  factoryId: string;
  orderId: string;
  version: number;
  status: QuoteStatus;
  parentQuoteId: string | null;
  currency: string;
  /** serialized Decimal(5,2) */
  taxRate: string;
  taxInclusive: boolean;
  /** serialized Decimal(14,2) */
  subtotal: string;
  discountAmount: string;
  discountReason: string | null;
  taxAmount: string;
  total: string;
  validUntil: string | null;
  sentToCustomerAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  notes: string | null;
  internalNotes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteDetail = QuoteListItem & {
  lines: QuoteLineDetail[];
};
