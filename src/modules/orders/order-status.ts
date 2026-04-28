export const ORDER_STATUS_VALUES = [
  "DRAFT",
  "QUOTED",
  "APPROVED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderWorkflowStatus = (typeof ORDER_STATUS_VALUES)[number];

export const INCOMPLETE_ORDER_STATUS_VALUES = [
  "DRAFT",
  "QUOTED",
  "APPROVED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
] as const satisfies OrderWorkflowStatus[];

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  DRAFT: "مسودة",
  QUOTED: "تم التسعير",
  APPROVED: "مؤكد",
  IN_PRODUCTION: "في الإنتاج",
  QUALITY_CHECK: "فحص الجودة",
  READY_FOR_DELIVERY: "جاهز للتسليم",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

export const ORDER_STATUS_TRANSITIONS: Record<
  OrderWorkflowStatus,
  OrderWorkflowStatus[]
> = {
  DRAFT: ["QUOTED", "CANCELLED"],
  QUOTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK: ["IN_PRODUCTION", "READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["DELIVERED", "IN_PRODUCTION"],
  DELIVERED: [],
  CANCELLED: [],
};
