import { z } from "zod";

export const COST_CATEGORY_VALUES = [
  "MATERIAL",
  "LABOR",
  "SERVICE",
  "OVERHEAD",
  "OTHER",
] as const;

export const CostCategoryEnum = z.enum(COST_CATEGORY_VALUES);
export type CostCategory = z.infer<typeof CostCategoryEnum>;

export const COST_CATEGORY_LABELS_AR: Record<CostCategory, string> = {
  MATERIAL: "مواد",
  LABOR: "عمالة",
  SERVICE: "خدمات",
  OVERHEAD: "مصاريف عامة",
  OTHER: "أخرى",
};

/** Maps a cost category to a status-tone color so charts/badges stay
 *  consistent with the global tone palette (see `src/lib/status-tone.ts`). */
export const COST_CATEGORY_TONE: Record<
  CostCategory,
  "planned" | "in-progress" | "waiting" | "draft" | "cancelled"
> = {
  MATERIAL: "planned",
  LABOR: "in-progress",
  SERVICE: "waiting",
  OVERHEAD: "draft",
  OTHER: "cancelled",
};

export const CostInput = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  category: CostCategoryEnum.default("OTHER"),
  amount: z.coerce.number().positive().max(99999999.99),
  currency: z.string().min(3).max(8).default("SAR"),
  description: z.string().min(2).max(400),
  vendorName: z.string().max(200).optional(),
  receiptUrl: z.string().max(500).optional(),
  incurredAt: z.string().min(1),
  stageInstanceId: z.string().min(1).nullable().optional(),
});
export type CostInputType = z.infer<typeof CostInput>;

export type CostListItem = {
  id: string;
  projectId: string;
  taskId: string | null;
  category: CostCategory;
  amount: string; // serialized Decimal as string for precision
  currency: string;
  description: string;
  vendorName: string | null;
  receiptUrl: string | null;
  incurredAt: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  stageInstanceId: string | null;
  stageName: string | null;
};

export type CostByStageEntry = {
  stageInstanceId: string | null;
  stageName: string;
  total: string;
  pct: number;
};

export type ProjectCostSummary = {
  projectId: string;
  totalCost: string;
  costsByCategory: Record<CostCategory, string>;
  costsByStage: CostByStageEntry[];
  quotedAmount: string | null;
  marginExpected: string | null;
  completionPercent: number;
};

export type FactoryCostSummary = {
  totalQuoted: string;
  totalCost: string;
  totalMargin: string;
  overBudgetCount: number;
  costsByCategory: Record<CostCategory, string>;
  projects: {
    projectId: string;
    projectCode: string;
    projectName: string;
    customerName: string | null;
    quotedAmount: string | null;
    totalCost: string;
    margin: string | null;
    status: string;
  }[];
};
