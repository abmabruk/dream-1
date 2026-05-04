import { z } from "zod";

export const INVOICE_STATUS_VALUES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;

export const InvoiceStatusEnum = z.enum(INVOICE_STATUS_VALUES);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

export const INVOICE_STATUS_LABELS_AR: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  SENT: "مُرسَلة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  VOID: "ملغاة",
};

export const CREDIT_NOTE_STATUS_VALUES = ["DRAFT", "ISSUED", "VOID"] as const;
export const CreditNoteStatusEnum = z.enum(CREDIT_NOTE_STATUS_VALUES);
export type CreditNoteStatus = z.infer<typeof CreditNoteStatusEnum>;

export const CREDIT_NOTE_STATUS_LABELS_AR: Record<CreditNoteStatus, string> = {
  DRAFT: "مسودة",
  ISSUED: "صادر",
  VOID: "ملغي",
};

// ─────────────────────────────────────────────
// Invoice line input
// ─────────────────────────────────────────────
export const InvoiceLineInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().max(99999999.9999),
  unitPrice: z.coerce.number().nonnegative().max(99999999.9999),
  productId: z.string().min(1).nullable().optional(),
  sku: z.string().max(120).nullable().optional(),
  quoteLineId: z.string().min(1).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});
export type InvoiceLineInputType = z.infer<typeof InvoiceLineInput>;

// ─────────────────────────────────────────────
// Create / Update invoice
// ─────────────────────────────────────────────
export const CreateInvoiceInput = z.object({
  customerId: z.string().min(1),
  orderId: z.string().min(1).nullable().optional(),
  quoteId: z.string().min(1).nullable().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  dueDate: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  discountAmount: z.coerce.number().nonnegative().max(99999999.99).optional(),
  lines: z.array(InvoiceLineInput).default([]),
});
export type CreateInvoiceInputType = z.infer<typeof CreateInvoiceInput>;

export const UpdateInvoiceInput = z.object({
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  dueDate: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  discountAmount: z.coerce.number().nonnegative().max(99999999.99).optional(),
  lines: z.array(InvoiceLineInput).optional(),
  expectedUpdatedAt: z.string().min(1).optional(),
});
export type UpdateInvoiceInputType = z.infer<typeof UpdateInvoiceInput>;

// ─────────────────────────────────────────────
// Credit note inputs
// ─────────────────────────────────────────────
export const CreditNoteLineInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().max(99999999.9999),
  unitPrice: z.coerce.number().nonnegative().max(99999999.9999),
  invoiceLineId: z.string().min(1).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});
export type CreditNoteLineInputType = z.infer<typeof CreditNoteLineInput>;

export const CreateCreditNoteInput = z.object({
  reason: z.string().min(1).max(500),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  lines: z.array(CreditNoteLineInput).default([]),
});
export type CreateCreditNoteInputType = z.infer<typeof CreateCreditNoteInput>;

// ─────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────
export type InvoiceLineDetail = {
  id: string;
  invoiceId: string;
  sortOrder: number;
  productId: string | null;
  quoteLineId: string | null;
  description: string;
  sku: string | null;
  /** Decimal(14,4) */
  quantity: string;
  /** Decimal(14,4) */
  unitPrice: string;
  /** Decimal(14,2) */
  lineTotal: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceListItem = {
  id: string;
  factoryId: string;
  customerId: string;
  orderId: string | null;
  quoteId: string | null;
  number: string;
  numberSeq: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  sentAt: string | null;
  voidedAt: string | null;
  voidedReason: string | null;
  currency: string;
  /** Decimal(5,2) */
  taxRate: string;
  taxInclusive: boolean;
  /** Decimal(14,2) */
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  sellerNameSnapshot: string | null;
  sellerTaxNumberSnapshot: string | null;
  sellerAddressSnapshot: string | null;
  buyerNameSnapshot: string | null;
  buyerTaxNumberSnapshot: string | null;
  buyerAddressSnapshot: string | null;
  notes: string | null;
  internalNotes: string | null;
  deletedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDetail = InvoiceListItem & {
  lines: InvoiceLineDetail[];
};

export type CreditNoteLineDetail = {
  id: string;
  creditNoteId: string;
  sortOrder: number;
  invoiceLineId: string | null;
  description: string;
  /** Decimal(14,4) */
  quantity: string;
  /** Decimal(14,4) */
  unitPrice: string;
  /** Decimal(14,2) */
  lineTotal: string;
  createdAt: string;
  updatedAt: string;
};

export type CreditNoteListItem = {
  id: string;
  factoryId: string;
  invoiceId: string;
  number: string;
  numberSeq: number;
  status: CreditNoteStatus;
  reason: string;
  currency: string;
  /** Decimal(5,2) */
  taxRate: string;
  /** Decimal(14,2) */
  subtotal: string;
  taxAmount: string;
  total: string;
  issuedAt: string | null;
  voidedAt: string | null;
  deletedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreditNoteDetail = CreditNoteListItem & {
  lines: CreditNoteLineDetail[];
};
