import "server-only";

import {
  Prisma,
  type InvoiceStatus as PrismaInvoiceStatus,
} from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import { decToString } from "@/lib/money";

import {
  type InvoiceDetail,
  type InvoiceLineDetail,
  type InvoiceListItem,
  type InvoiceStatus,
} from "./invoice.schemas";

export interface InvoiceHeaderWritable {
  customerId: string;
  orderId: string | null;
  quoteId: string | null;
  taxRate: Prisma.Decimal;
  taxInclusive: boolean;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  dueDate: Date | null;
  notes: string | null;
  internalNotes: string | null;
}

export interface InvoiceLineWritable {
  description: string;
  productId: string | null;
  sku: string | null;
  quoteLineId: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
}

type InvoiceRow = Prisma.InvoiceGetPayload<{
  include: {
    lines: true;
    createdBy: { select: { firstName: true; lastName: true } };
  };
}>;

const DEFAULT_INCLUDE = {
  lines: true,
  createdBy: { select: { firstName: true, lastName: true } },
} as const;

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

function mapLine(line: InvoiceRow["lines"][number]): InvoiceLineDetail {
  return {
    id: line.id,
    invoiceId: line.invoiceId,
    sortOrder: line.sortOrder,
    productId: line.productId ?? null,
    quoteLineId: line.quoteLineId ?? null,
    description: line.description,
    sku: line.sku ?? null,
    quantity: decToString4(line.quantity),
    unitPrice: decToString4(line.unitPrice),
    lineTotal: decToString(line.lineTotal),
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

function mapListItem(inv: InvoiceRow): InvoiceListItem {
  const due = inv.total.minus(inv.amountPaid);
  return {
    id: inv.id,
    factoryId: inv.factoryId,
    customerId: inv.customerId,
    orderId: inv.orderId ?? null,
    quoteId: inv.quoteId ?? null,
    number: inv.number,
    numberSeq: inv.numberSeq,
    status: inv.status as InvoiceStatus,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    voidedAt: inv.voidedAt ? inv.voidedAt.toISOString() : null,
    voidedReason: inv.voidedReason ?? null,
    currency: inv.currency,
    taxRate: inv.taxRate.toFixed(2),
    taxInclusive: inv.taxInclusive,
    subtotal: decToString(inv.subtotal),
    discountAmount: decToString(inv.discountAmount),
    taxAmount: decToString(inv.taxAmount),
    total: decToString(inv.total),
    amountPaid: decToString(inv.amountPaid),
    amountDue: decToString(due),
    sellerNameSnapshot: inv.sellerNameSnapshot ?? null,
    sellerTaxNumberSnapshot: inv.sellerTaxNumberSnapshot ?? null,
    sellerAddressSnapshot: inv.sellerAddressSnapshot ?? null,
    buyerNameSnapshot: inv.buyerNameSnapshot ?? null,
    buyerTaxNumberSnapshot: inv.buyerTaxNumberSnapshot ?? null,
    buyerAddressSnapshot: inv.buyerAddressSnapshot ?? null,
    notes: inv.notes ?? null,
    internalNotes: inv.internalNotes ?? null,
    deletedAt: inv.deletedAt ? inv.deletedAt.toISOString() : null,
    createdById: inv.createdById ?? null,
    createdByName: displayName(inv.createdBy),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

function mapDetail(inv: InvoiceRow): InvoiceDetail {
  const lines = [...inv.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapLine);
  return { ...mapListItem(inv), lines };
}

export interface InvoiceListFilters {
  customerId?: string;
  status?: InvoiceStatus;
  from?: Date;
  to?: Date;
  /** "active" excludes soft-deleted (default), "all" includes them, "deleted" returns only deleted */
  deletedFilter?: "active" | "all" | "deleted";
}

export class InvoiceRepository {
  async list(
    factoryId: string,
    filters: InvoiceListFilters = {},
  ): Promise<InvoiceListItem[]> {
    const where: Prisma.InvoiceWhereInput = { factoryId };
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.issueDate = {};
      if (filters.from) (where.issueDate as { gte?: Date }).gte = filters.from;
      if (filters.to) (where.issueDate as { lte?: Date }).lte = filters.to;
    }
    const deletedFilter = filters.deletedFilter ?? "active";
    if (deletedFilter === "active") where.deletedAt = null;
    else if (deletedFilter === "deleted") where.deletedAt = { not: null };

    const rows = await db.invoice.findMany({
      where,
      include: DEFAULT_INCLUDE,
      orderBy: [{ issueDate: "desc" }, { numberSeq: "desc" }],
    });
    return rows.map(mapListItem);
  }

  async getById(
    factoryId: string,
    invoiceId: string,
  ): Promise<InvoiceDetail | null> {
    const row = await db.invoice.findFirst({
      where: { id: invoiceId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async getRawById(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
  ) {
    return tx.invoice.findFirst({
      where: { id: invoiceId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
  }

  async getDetailInTx(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
  ): Promise<InvoiceDetail | null> {
    const row = await tx.invoice.findFirst({
      where: { id: invoiceId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async findCustomer(
    tx: PrismaTransaction,
    factoryId: string,
    customerId: string,
  ): Promise<{
    id: string;
    name: string;
    taxNumber: string | null;
    address: string | null;
  } | null> {
    return tx.customer.findFirst({
      where: { id: customerId, factoryId },
      select: { id: true, name: true, taxNumber: true, address: true },
    });
  }

  async findFactory(
    tx: PrismaTransaction,
    factoryId: string,
  ): Promise<{
    id: string;
    name: string;
    taxNumber: string | null;
    address: string | null;
  } | null> {
    return tx.factory.findUnique({
      where: { id: factoryId },
      select: { id: true, name: true, taxNumber: true, address: true },
    });
  }

  async findOrder(
    tx: PrismaTransaction,
    factoryId: string,
    orderId: string,
  ): Promise<{ id: string; customerId: string } | null> {
    return tx.order.findFirst({
      where: { id: orderId, factoryId },
      select: { id: true, customerId: true },
    });
  }

  async findQuoteWithLines(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ) {
    return tx.quote.findFirst({
      where: { id: quoteId, factoryId, deletedAt: null },
      include: {
        lines: true,
        order: { select: { id: true, customerId: true } },
      },
    });
  }

  /**
   * Acquires a Postgres advisory lock scoped to the current transaction so
   * sequential invoice numbers cannot collide across concurrent transactions.
   */
  async acquireNumberLock(
    tx: PrismaTransaction,
    factoryId: string,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `invoice_seq:${factoryId}`,
    );
  }

  async getLastNumberSeq(
    tx: PrismaTransaction,
    factoryId: string,
  ): Promise<number> {
    const last = await tx.invoice.findFirst({
      where: { factoryId },
      orderBy: { numberSeq: "desc" },
      select: { numberSeq: true },
    });
    return last?.numberSeq ?? 0;
  }

  async createDraft(
    tx: PrismaTransaction,
    factoryId: string,
    actorUserId: string,
    args: {
      header: InvoiceHeaderWritable;
      lines: InvoiceLineWritable[];
      /** Placeholder number — DRAFT invoices use a temp value; assigned for real on send(). */
      placeholderNumber: string;
      placeholderSeq: number;
    },
  ): Promise<InvoiceDetail> {
    const created = await tx.invoice.create({
      data: {
        factoryId,
        customerId: args.header.customerId,
        orderId: args.header.orderId,
        quoteId: args.header.quoteId,
        number: args.placeholderNumber,
        numberSeq: args.placeholderSeq,
        status: "DRAFT",
        currency: "SAR",
        taxRate: args.header.taxRate,
        taxInclusive: args.header.taxInclusive,
        subtotal: args.header.subtotal,
        discountAmount: args.header.discountAmount,
        taxAmount: args.header.taxAmount,
        total: args.header.total,
        dueDate: args.header.dueDate,
        notes: args.header.notes,
        internalNotes: args.header.internalNotes,
        createdById: actorUserId,
        lines: {
          create: args.lines.map((l) => ({
            sortOrder: l.sortOrder,
            productId: l.productId,
            quoteLineId: l.quoteLineId,
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

  async updateHeaderAndLines(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
    args: {
      header: Pick<
        InvoiceHeaderWritable,
        | "taxRate"
        | "taxInclusive"
        | "subtotal"
        | "discountAmount"
        | "taxAmount"
        | "total"
        | "dueDate"
        | "notes"
        | "internalNotes"
      >;
      replaceLines?: InvoiceLineWritable[];
    },
  ): Promise<InvoiceDetail> {
    if (args.replaceLines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId } });
      if (args.replaceLines.length > 0) {
        await tx.invoiceLine.createMany({
          data: args.replaceLines.map((l) => ({
            invoiceId,
            sortOrder: l.sortOrder,
            productId: l.productId,
            quoteLineId: l.quoteLineId,
            description: l.description,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        });
      }
    }
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        taxRate: args.header.taxRate,
        taxInclusive: args.header.taxInclusive,
        subtotal: args.header.subtotal,
        discountAmount: args.header.discountAmount,
        taxAmount: args.header.taxAmount,
        total: args.header.total,
        dueDate: args.header.dueDate,
        notes: args.header.notes,
        internalNotes: args.header.internalNotes,
      },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async updateTotals(
    tx: PrismaTransaction,
    invoiceId: string,
    totals: {
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
    },
  ): Promise<InvoiceDetail> {
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: totals,
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async addLine(
    tx: PrismaTransaction,
    invoiceId: string,
    line: InvoiceLineWritable,
  ): Promise<void> {
    await tx.invoiceLine.create({
      data: {
        invoiceId,
        sortOrder: line.sortOrder,
        productId: line.productId,
        quoteLineId: line.quoteLineId,
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
    invoiceId: string,
    lineId: string,
    line: InvoiceLineWritable,
  ): Promise<void> {
    const res = await tx.invoiceLine.updateMany({
      where: { id: lineId, invoiceId },
      data: {
        sortOrder: line.sortOrder,
        productId: line.productId,
        quoteLineId: line.quoteLineId,
        description: line.description,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      },
    });
    if (res.count === 0) throw new Error("Invoice line not found.");
  }

  async deleteLine(
    tx: PrismaTransaction,
    invoiceId: string,
    lineId: string,
  ): Promise<void> {
    const res = await tx.invoiceLine.deleteMany({
      where: { id: lineId, invoiceId },
    });
    if (res.count === 0) throw new Error("Invoice line not found.");
  }

  async assignNumberAndSend(
    tx: PrismaTransaction,
    invoiceId: string,
    args: {
      number: string;
      numberSeq: number;
      sentAt: Date;
      sellerNameSnapshot: string | null;
      sellerTaxNumberSnapshot: string | null;
      sellerAddressSnapshot: string | null;
      buyerNameSnapshot: string | null;
      buyerTaxNumberSnapshot: string | null;
      buyerAddressSnapshot: string | null;
    },
  ): Promise<InvoiceDetail> {
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "SENT",
        number: args.number,
        numberSeq: args.numberSeq,
        sentAt: args.sentAt,
        sellerNameSnapshot: args.sellerNameSnapshot,
        sellerTaxNumberSnapshot: args.sellerTaxNumberSnapshot,
        sellerAddressSnapshot: args.sellerAddressSnapshot,
        buyerNameSnapshot: args.buyerNameSnapshot,
        buyerTaxNumberSnapshot: args.buyerTaxNumberSnapshot,
        buyerAddressSnapshot: args.buyerAddressSnapshot,
      },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async setStatus(
    tx: PrismaTransaction,
    invoiceId: string,
    status: PrismaInvoiceStatus,
    extra: {
      voidedAt?: Date | null;
      voidedReason?: string | null;
      amountPaid?: Prisma.Decimal;
    } = {},
  ): Promise<InvoiceDetail> {
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status, ...extra },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async softDelete(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
  ): Promise<{ id: string }> {
    const res = await tx.invoice.updateMany({
      where: { id: invoiceId, factoryId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new Error("Invoice not found.");
    return { id: invoiceId };
  }
}
