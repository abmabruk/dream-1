import "server-only";

import { Prisma, type QuoteStatus as PrismaQuoteStatus } from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import { decToString } from "@/lib/money";
import {
  type QuoteDetail,
  type QuoteLineDetail,
  type QuoteListItem,
  type QuoteStatus,
} from "./quote.schemas";

/**
 * Computed fields for persisting a quote header — the service is responsible
 * for producing these via src/lib/money.ts before calling the repository.
 */
export interface QuoteHeaderWritable {
  taxRate: Prisma.Decimal;
  taxInclusive: boolean;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountReason: string | null;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  validUntil: Date | null;
  notes: string | null;
  internalNotes: string | null;
}

export interface QuoteLineWritable {
  description: string;
  productId: string | null;
  sku: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
}

type QuoteRowWithRelations = Prisma.QuoteGetPayload<{
  include: {
    lines: true;
    createdBy: { select: { firstName: true; lastName: true } };
  };
}>;

function displayName(
  user: { firstName: string; lastName: string } | null | undefined,
): string | null {
  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name.length > 0 ? name : null;
}

function decToString4(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) return "0.0000";
  return value.toFixed(4);
}

function mapLine(line: QuoteRowWithRelations["lines"][number]): QuoteLineDetail {
  return {
    id: line.id,
    quoteId: line.quoteId,
    sortOrder: line.sortOrder,
    productId: line.productId ?? null,
    description: line.description,
    sku: line.sku ?? null,
    quantity: decToString4(line.quantity),
    unitPrice: decToString4(line.unitPrice),
    lineTotal: decToString(line.lineTotal),
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

function mapListItem(q: QuoteRowWithRelations): QuoteListItem {
  return {
    id: q.id,
    factoryId: q.factoryId,
    orderId: q.orderId,
    version: q.version,
    status: q.status as QuoteStatus,
    parentQuoteId: q.parentQuoteId ?? null,
    currency: q.currency,
    taxRate: q.taxRate.toFixed(2),
    taxInclusive: q.taxInclusive,
    subtotal: decToString(q.subtotal),
    discountAmount: decToString(q.discountAmount),
    discountReason: q.discountReason ?? null,
    taxAmount: decToString(q.taxAmount),
    total: decToString(q.total),
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    sentToCustomerAt: q.sentToCustomerAt ? q.sentToCustomerAt.toISOString() : null,
    approvedAt: q.approvedAt ? q.approvedAt.toISOString() : null,
    approvedById: q.approvedById ?? null,
    notes: q.notes ?? null,
    internalNotes: q.internalNotes ?? null,
    createdById: q.createdById ?? null,
    createdByName: displayName(q.createdBy),
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function mapDetail(q: QuoteRowWithRelations): QuoteDetail {
  const lines = [...q.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapLine);
  return { ...mapListItem(q), lines };
}

const DEFAULT_INCLUDE = {
  lines: true,
  createdBy: { select: { firstName: true, lastName: true } },
} as const;

export class QuoteRepository {
  async listByOrder(factoryId: string, orderId: string): Promise<QuoteListItem[]> {
    const rows = await db.quote.findMany({
      where: { factoryId, orderId, deletedAt: null },
      include: DEFAULT_INCLUDE,
      orderBy: [{ version: "desc" }],
    });
    return rows.map(mapListItem);
  }

  async getById(factoryId: string, quoteId: string): Promise<QuoteDetail | null> {
    const row = await db.quote.findFirst({
      where: { id: quoteId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async findOrder(
    tx: PrismaTransaction,
    factoryId: string,
    orderId: string,
  ): Promise<{ id: string } | null> {
    return tx.order.findFirst({
      where: { id: orderId, factoryId },
      select: { id: true },
    });
  }

  async nextVersionForOrder(
    tx: PrismaTransaction,
    factoryId: string,
    orderId: string,
  ): Promise<number> {
    const last = await tx.quote.findFirst({
      where: { factoryId, orderId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (last?.version ?? 0) + 1;
  }

  /**
   * Create the quote header + lines in a single transaction. Caller has
   * already computed totals using src/lib/money.ts.
   */
  async createWithLines(
    tx: PrismaTransaction,
    factoryId: string,
    actorUserId: string,
    args: {
      orderId: string;
      version: number;
      parentQuoteId: string | null;
      header: QuoteHeaderWritable;
      lines: QuoteLineWritable[];
    },
  ): Promise<QuoteDetail> {
    const created = await tx.quote.create({
      data: {
        factoryId,
        orderId: args.orderId,
        version: args.version,
        parentQuoteId: args.parentQuoteId,
        status: "DRAFT",
        currency: "SAR",
        taxRate: args.header.taxRate,
        taxInclusive: args.header.taxInclusive,
        subtotal: args.header.subtotal,
        discountAmount: args.header.discountAmount,
        discountReason: args.header.discountReason,
        taxAmount: args.header.taxAmount,
        total: args.header.total,
        validUntil: args.header.validUntil,
        notes: args.header.notes,
        internalNotes: args.header.internalNotes,
        createdById: actorUserId,
        lines: {
          create: args.lines.map((l) => ({
            factoryId,
            sortOrder: l.sortOrder,
            productId: l.productId,
            description: l.description,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(created);
  }

  /**
   * Replace header fields and (optionally) the entire line set. Service is
   * responsible for ensuring DRAFT-only and optimistic concurrency.
   */
  async updateWithLines(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
    args: {
      header: QuoteHeaderWritable;
      replaceLines?: QuoteLineWritable[];
    },
  ): Promise<QuoteDetail> {
    if (args.replaceLines) {
      await tx.quoteLine.deleteMany({ where: { factoryId, quoteId } });
      if (args.replaceLines.length > 0) {
        await tx.quoteLine.createMany({
          data: args.replaceLines.map((l) => ({
            factoryId,
            quoteId,
            sortOrder: l.sortOrder,
            productId: l.productId,
            description: l.description,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        });
      }
    }

    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        taxRate: args.header.taxRate,
        taxInclusive: args.header.taxInclusive,
        subtotal: args.header.subtotal,
        discountAmount: args.header.discountAmount,
        discountReason: args.header.discountReason,
        taxAmount: args.header.taxAmount,
        total: args.header.total,
        validUntil: args.header.validUntil,
        notes: args.header.notes,
        internalNotes: args.header.internalNotes,
      },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  /** Recompute totals only — no line changes, no header field writes. */
  async updateTotals(
    tx: PrismaTransaction,
    quoteId: string,
    totals: {
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
    },
  ): Promise<QuoteDetail> {
    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: totals,
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async setStatus(
    tx: PrismaTransaction,
    quoteId: string,
    status: PrismaQuoteStatus,
    extra: {
      sentToCustomerAt?: Date | null;
      approvedAt?: Date | null;
      approvedById?: string | null;
    } = {},
  ): Promise<QuoteDetail> {
    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        status,
        ...extra,
      },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async supersedeApprovedSiblings(
    tx: PrismaTransaction,
    factoryId: string,
    orderId: string,
    excludeQuoteId: string,
  ): Promise<number> {
    const res = await tx.quote.updateMany({
      where: {
        factoryId,
        orderId,
        status: "APPROVED",
        id: { not: excludeQuoteId },
      },
      data: { status: "SUPERSEDED" },
    });
    return res.count;
  }

  async setOrderQuotedAmount(
    tx: PrismaTransaction,
    factoryId: string,
    orderId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    await tx.order.updateMany({
      where: { id: orderId, factoryId },
      data: { quotedAmount: amount },
    });
  }

  async getRawById(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ) {
    return tx.quote.findFirst({
      where: { id: quoteId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
  }

  async getDetailInTx(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ): Promise<QuoteDetail | null> {
    const row = await tx.quote.findFirst({
      where: { id: quoteId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async addLine(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
    line: QuoteLineWritable,
  ): Promise<void> {
    await tx.quoteLine.create({
      data: {
        factoryId,
        quoteId,
        sortOrder: line.sortOrder,
        productId: line.productId,
        description: line.description,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      },
    });
  }

  async updateLine(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
    lineId: string,
    line: QuoteLineWritable,
  ): Promise<void> {
    const res = await tx.quoteLine.updateMany({
      where: { id: lineId, factoryId, quoteId },
      data: {
        sortOrder: line.sortOrder,
        productId: line.productId,
        description: line.description,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      },
    });
    if (res.count === 0) {
      throw new Error("Quote line not found.");
    }
  }

  async deleteLine(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
    lineId: string,
  ): Promise<void> {
    const res = await tx.quoteLine.deleteMany({
      where: { id: lineId, factoryId, quoteId },
    });
    if (res.count === 0) {
      throw new Error("Quote line not found.");
    }
  }

  async setLineSortOrders(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
    orderedLineIds: string[],
  ): Promise<void> {
    for (let i = 0; i < orderedLineIds.length; i += 1) {
      await tx.quoteLine.updateMany({
        where: { id: orderedLineIds[i], factoryId, quoteId },
        data: { sortOrder: i },
      });
    }
  }

  async listLines(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ): Promise<Array<{ id: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal }>> {
    return tx.quoteLine.findMany({
      where: { factoryId, quoteId },
      select: { id: true, quantity: true, unitPrice: true, lineTotal: true },
    });
  }

  async softDelete(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ): Promise<{ id: string }> {
    const res = await tx.quote.updateMany({
      where: { id: quoteId, factoryId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) {
      throw new Error("Quote not found.");
    }
    return { id: quoteId };
  }
}
