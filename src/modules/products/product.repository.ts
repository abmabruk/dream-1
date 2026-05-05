import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { roundUnitPrice } from "@/lib/money";
import type {
  CreateProductInputType,
  ListProductOptions,
  ProductDetail,
  ProductListItem,
  ProductPickerItem,
  UpdateProductInputType,
  VariantDetail,
  VariantInputType,
} from "./product.schemas";

// ────────────────────────────────────────────────────────────
// Row shapes (defensive: written before `prisma generate` confirms types)
// ────────────────────────────────────────────────────────────
type ProductRow = {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  defaultUnitPrice: Prisma.Decimal;
  estimatedUnitCost: Prisma.Decimal;
  currency: string;
  lowStockThreshold: number | null;
  deletedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProductVariantRow = {
  id: string;
  productId: string;
  code: string;
  name: string;
  attributes: unknown;
  unitPriceDelta: Prisma.Decimal;
  estimatedUnitCostDelta: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ProductWithVariants = ProductRow & {
  variants?: ProductVariantRow[];
  _count?: { variants: number };
};

interface ProductDelegate {
  create(args: {
    data: Record<string, unknown>;
    include?: Record<string, unknown>;
  }): Promise<ProductWithVariants>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
    include?: Record<string, unknown>;
  }): Promise<ProductWithVariants>;
  findFirst(args: {
    where: Record<string, unknown>;
    include?: Record<string, unknown>;
  }): Promise<ProductWithVariants | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, unknown>>;
    take?: number;
    select?: Record<string, unknown>;
  }): Promise<ProductWithVariants[]>;
}

interface ProductVariantDelegate {
  create(args: { data: Record<string, unknown> }): Promise<ProductVariantRow>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<ProductVariantRow>;
  delete(args: { where: { id: string } }): Promise<ProductVariantRow>;
  findFirst(args: {
    where: Record<string, unknown>;
  }): Promise<ProductVariantRow | null>;
}

interface DbWithProduct {
  product: ProductDelegate;
  productVariant: ProductVariantDelegate;
}

interface TxWithProduct {
  product: ProductDelegate;
  productVariant: ProductVariantDelegate;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function decToString4(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) return "0.0000";
  return value.toFixed(4);
}

function normalizeAttributes(
  attrs: unknown,
): Record<string, string | number | boolean> {
  if (!attrs || typeof attrs !== "object") return {};
  return attrs as Record<string, string | number | boolean>;
}

function mapVariant(v: ProductVariantRow): VariantDetail {
  return {
    id: v.id,
    productId: v.productId,
    code: v.code,
    name: v.name,
    attributes: normalizeAttributes(v.attributes),
    unitPriceDelta: decToString4(v.unitPriceDelta),
    estimatedUnitCostDelta: decToString4(v.estimatedUnitCostDelta),
    isActive: v.isActive,
  };
}

function mapListItem(p: ProductWithVariants): ProductListItem {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    tags: p.tags ?? [],
    defaultUnitPrice: decToString4(p.defaultUnitPrice),
    currency: p.currency,
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    variantCount:
      p._count?.variants ?? (p.variants ? p.variants.length : 0),
  };
}

function mapDetail(p: ProductWithVariants): ProductDetail {
  return {
    ...mapListItem(p),
    description: p.description,
    estimatedUnitCost: decToString4(p.estimatedUnitCost),
    lowStockThreshold: p.lowStockThreshold,
    variants: (p.variants ?? []).map(mapVariant),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

const PRODUCT_INCLUDE = {
  variants: { orderBy: { createdAt: "asc" as const } },
  _count: { select: { variants: true } },
} as const;

// ────────────────────────────────────────────────────────────
// Repository
// ────────────────────────────────────────────────────────────
export class ProductRepository {
  async list(
    factoryId: string,
    opts?: ListProductOptions,
  ): Promise<ProductListItem[]> {
    const where: Record<string, unknown> = { factoryId };

    const filter = opts?.deletedFilter ?? "active";
    if (filter === "active") where.deletedAt = null;
    else if (filter === "deleted") where.deletedAt = { not: null };
    // "all" → no filter

    if (opts?.category) {
      where.category = opts.category;
    }
    if (opts?.tags && opts.tags.length > 0) {
      where.tags = { hasSome: opts.tags };
    }
    if (opts?.search) {
      const q = opts.search.trim();
      if (q.length > 0) {
        where.OR = [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    const dbc = db as unknown as DbWithProduct;
    const rows = await dbc.product.findMany({
      where,
      include: { _count: { select: { variants: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 500,
    });
    return rows.map(mapListItem);
  }

  async getById(
    factoryId: string,
    productId: string,
  ): Promise<ProductDetail | null> {
    const dbc = db as unknown as DbWithProduct;
    const row = await dbc.product.findFirst({
      where: { id: productId, factoryId },
      include: PRODUCT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async create(
    factoryId: string,
    actorUserId: string,
    input: CreateProductInputType,
  ): Promise<ProductDetail> {
    try {
      return await db.$transaction(async (tx) => {
        const txc = tx as unknown as TxWithProduct;
        const created = await txc.product.create({
          data: {
            factoryId,
            code: input.code,
            name: input.name,
            description: input.description ?? null,
            category: input.category ?? null,
            tags: input.tags ?? [],
            defaultUnitPrice: roundUnitPrice(input.defaultUnitPrice),
            estimatedUnitCost: roundUnitPrice(input.estimatedUnitCost ?? 0),
            currency: input.currency ?? "SAR",
            lowStockThreshold: input.lowStockThreshold ?? null,
            createdById: actorUserId,
          },
        });

        if (input.variants && input.variants.length > 0) {
          for (const v of input.variants) {
            await txc.productVariant.create({
              data: buildVariantData(created.id, v),
            });
          }
        }

        const full = await txc.product.findFirst({
          where: { id: created.id, factoryId },
          include: PRODUCT_INCLUDE,
        });
        if (!full) throw new HttpError(500, "تعذر تحميل المنتج بعد إنشائه.");
        return mapDetail(full);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, "كود المنتج موجود مسبقاً");
      }
      throw err;
    }
  }

  async update(
    factoryId: string,
    productId: string,
    input: UpdateProductInputType,
  ): Promise<ProductDetail> {
    const dbc = db as unknown as DbWithProduct;
    const existing = await dbc.product.findFirst({
      where: { id: productId, factoryId },
    });
    if (!existing) throw new HttpError(404, "المنتج غير موجود.");

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined)
      data.description = input.description ?? null;
    if (input.category !== undefined) data.category = input.category ?? null;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.defaultUnitPrice !== undefined)
      data.defaultUnitPrice = roundUnitPrice(input.defaultUnitPrice);
    if (input.estimatedUnitCost !== undefined)
      data.estimatedUnitCost = roundUnitPrice(input.estimatedUnitCost);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.lowStockThreshold !== undefined)
      data.lowStockThreshold = input.lowStockThreshold ?? null;

    try {
      const updated = await dbc.product.update({
        where: { id: productId },
        data,
        include: PRODUCT_INCLUDE,
      });
      return mapDetail(updated);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, "كود المنتج موجود مسبقاً");
      }
      throw err;
    }
  }

  async softDelete(
    factoryId: string,
    productId: string,
  ): Promise<{ id: string }> {
    const dbc = db as unknown as DbWithProduct;
    const existing = await dbc.product.findFirst({
      where: { id: productId, factoryId },
    });
    if (!existing) throw new HttpError(404, "المنتج غير موجود.");
    await dbc.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });
    return { id: productId };
  }

  async restore(
    factoryId: string,
    productId: string,
  ): Promise<ProductDetail> {
    const dbc = db as unknown as DbWithProduct;
    const existing = await dbc.product.findFirst({
      where: { id: productId, factoryId },
    });
    if (!existing) throw new HttpError(404, "المنتج غير موجود.");
    const restored = await dbc.product.update({
      where: { id: productId },
      data: { deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    return mapDetail(restored);
  }

  async addVariant(
    factoryId: string,
    productId: string,
    input: VariantInputType,
  ): Promise<VariantDetail> {
    const dbc = db as unknown as DbWithProduct;
    const product = await dbc.product.findFirst({
      where: { id: productId, factoryId },
    });
    if (!product) throw new HttpError(404, "المنتج غير موجود.");

    try {
      const created = await dbc.productVariant.create({
        data: buildVariantData(productId, input),
      });
      return mapVariant(created);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, "كود المتغيّر موجود مسبقاً");
      }
      throw err;
    }
  }

  async updateVariant(
    factoryId: string,
    productId: string,
    variantId: string,
    input: VariantInputType,
  ): Promise<VariantDetail> {
    const dbc = db as unknown as DbWithProduct;
    const product = await dbc.product.findFirst({
      where: { id: productId, factoryId },
    });
    if (!product) throw new HttpError(404, "المنتج غير موجود.");
    const existing = await dbc.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existing) throw new HttpError(404, "المتغيّر غير موجود.");

    try {
      const updated = await dbc.productVariant.update({
        where: { id: variantId },
        data: buildVariantData(productId, input, /*forUpdate*/ true),
      });
      return mapVariant(updated);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, "كود المتغيّر موجود مسبقاً");
      }
      throw err;
    }
  }

  async deleteVariant(
    factoryId: string,
    productId: string,
    variantId: string,
  ): Promise<{ id: string }> {
    const dbc = db as unknown as DbWithProduct;
    const product = await dbc.product.findFirst({
      where: { id: productId, factoryId },
    });
    if (!product) throw new HttpError(404, "المنتج غير موجود.");
    const existing = await dbc.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existing) throw new HttpError(404, "المتغيّر غير موجود.");
    await dbc.productVariant.delete({ where: { id: variantId } });
    return { id: variantId };
  }

  async searchForPicker(
    factoryId: string,
    query: string,
    limit = 20,
  ): Promise<ProductPickerItem[]> {
    const where: Record<string, unknown> = { factoryId, deletedAt: null };
    const q = (query ?? "").trim();
    if (q.length > 0) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    const dbc = db as unknown as DbWithProduct;
    const rows = await dbc.product.findMany({
      where,
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ name: "asc" }],
      take: Math.max(1, Math.min(limit, 100)),
    });
    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      defaultUnitPrice: decToString4(p.defaultUnitPrice),
      variants: (p.variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        unitPriceDelta: decToString4(v.unitPriceDelta),
      })),
    }));
  }
}

function buildVariantData(
  productId: string,
  v: VariantInputType,
  forUpdate = false,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    code: v.code,
    name: v.name,
    attributes: v.attributes ?? {},
    unitPriceDelta: roundUnitPrice(v.unitPriceDelta ?? 0),
    estimatedUnitCostDelta: roundUnitPrice(v.estimatedUnitCostDelta ?? 0),
    isActive: v.isActive ?? true,
  };
  if (!forUpdate) {
    data.productId = productId;
  }
  return data;
}
