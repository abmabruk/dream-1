import { z } from "zod";

import { emptyStringToUndefined } from "@/lib/zod-helpers";

export const PAYMENT_KIND_VALUES = ["PAYMENT", "REFUND", "ADJUSTMENT"] as const;
export const PaymentKindEnum = z.enum(PAYMENT_KIND_VALUES);
export type PaymentKind = z.infer<typeof PaymentKindEnum>;

export const PAYMENT_KIND_LABELS_AR: Record<PaymentKind, string> = {
  PAYMENT: "دفعة",
  REFUND: "استرجاع",
  ADJUSTMENT: "تسوية",
};

export const PAYMENT_METHOD_VALUES = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "CARD",
  "OTHER",
] as const;
export const PaymentMethodEnum = z.enum(PAYMENT_METHOD_VALUES);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const PAYMENT_METHOD_LABELS_AR: Record<PaymentMethod, string> = {
  CASH: "نقدًا",
  BANK_TRANSFER: "تحويل بنكي",
  CHECK: "شيك",
  CARD: "بطاقة",
  OTHER: "أخرى",
};

// ─────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────
export const AllocationInput = z.object({
  invoiceId: z.string().min(1),
  amount: z.union([z.coerce.number().positive(), z.string().min(1)]),
});
export type AllocationInputType = z.infer<typeof AllocationInput>;

export const RecordPaymentInput = z.object({
  customerId: z.string().min(1),
  kind: PaymentKindEnum.optional(),
  method: PaymentMethodEnum.optional(),
  reference: emptyStringToUndefined(z.string().max(120).nullable().optional()),
  receivedAt: emptyStringToUndefined(z.string().min(1).optional()),
  amount: z.union([z.coerce.number().positive(), z.string().min(1)]),
  notes: emptyStringToUndefined(z.string().max(2000).nullable().optional()),
  allocations: z.array(AllocationInput).default([]),
});
export type RecordPaymentInputType = z.infer<typeof RecordPaymentInput>;

export const UpdatePaymentInput = z.object({
  method: PaymentMethodEnum.optional(),
  reference: emptyStringToUndefined(z.string().max(120).nullable().optional()),
  notes: emptyStringToUndefined(z.string().max(2000).nullable().optional()),
});
export type UpdatePaymentInputType = z.infer<typeof UpdatePaymentInput>;

// ─────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────
export type PaymentAllocationDetail = {
  id: string;
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  /** Decimal(14,2) — always positive (semantics differ for REFUND) */
  amount: string;
  createdAt: string;
};

export type PaymentListItem = {
  id: string;
  factoryId: string;
  customerId: string;
  customerName: string | null;
  kind: PaymentKind;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: string;
  /** Decimal(14,2) — stored positive even for REFUND */
  amount: string;
  /** Decimal(14,2) — sum of allocations */
  allocatedAmount: string;
  /** Decimal(14,2) — amount - allocatedAmount */
  unallocatedAmount: string;
  currency: string;
  notes: string | null;
  deletedAt: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDetail = PaymentListItem & {
  allocations: PaymentAllocationDetail[];
};
