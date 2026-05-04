import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Input schemas
// ────────────────────────────────────────────────────────────
export const VariantInput = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  attributes: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
  unitPriceDelta: z.coerce.number().optional(),
  estimatedUnitCostDelta: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
});
export type VariantInputType = z.infer<typeof VariantInput>;

export const CreateProductInput = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).optional(),
  defaultUnitPrice: z.coerce.number().min(0).max(99999999.9999),
  estimatedUnitCost: z.coerce.number().min(0).max(99999999.9999).optional(),
  currency: z.string().min(3).max(8).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  variants: z.array(VariantInput).optional(),
});
export type CreateProductInputType = z.infer<typeof CreateProductInput>;

export const UpdateProductInput = CreateProductInput.partial().omit({
  variants: true,
});
export type UpdateProductInputType = z.infer<typeof UpdateProductInput>;

// ────────────────────────────────────────────────────────────
// Result types
// ────────────────────────────────────────────────────────────
export type VariantDetail = {
  id: string;
  productId: string;
  code: string;
  name: string;
  attributes: Record<string, string | number | boolean>;
  unitPriceDelta: string;
  estimatedUnitCostDelta: string;
  isActive: boolean;
};

export type ProductListItem = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  tags: string[];
  defaultUnitPrice: string;
  currency: string;
  deletedAt: string | null;
  createdAt: string;
  variantCount: number;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
  estimatedUnitCost: string;
  lowStockThreshold: number | null;
  variants: VariantDetail[];
};

export type ProductPickerItem = {
  id: string;
  code: string;
  name: string;
  defaultUnitPrice: string;
  variants: Array<{ id: string; name: string; unitPriceDelta: string }>;
};

export type DeletedFilter = "active" | "deleted" | "all";

export type ListProductOptions = {
  search?: string;
  category?: string;
  tags?: string[];
  deletedFilter?: DeletedFilter;
};
