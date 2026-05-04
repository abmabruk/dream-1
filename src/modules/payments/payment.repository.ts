import "server-only";

import { Prisma } from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import { decToString } from "@/lib/money";

import {
  type PaymentAllocationDetail,
  type PaymentDetail,
  type PaymentKind,
  type PaymentListItem,
  type PaymentMethod,
} from "./payment.schemas";

type PaymentRow = Prisma.PaymentGetPayload<{
  include: {
    customer: { select: { name: true } };
    recordedBy: { select: { firstName: true; lastName: true } };
    allocations: {
      include: { invoice: { select: { number: true } } };
    };
  };
}>;

const DEFAULT_INCLUDE = {
  customer: { select: { name: true } },
  recordedBy: { select: { firstName: true, lastName: true } },
  allocations: {
    include: { invoice: { select: { number: true } } },
  },
} as const;

function displayName(
  user: { firstName: string; lastName: string } | null | undefined,
): string | null {
  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name.length > 0 ? name : null;
}

function sumAllocations(allocs: PaymentRow["allocations"]): Prisma.Decimal {
  return allocs.reduce<Prisma.Decimal>(
    (acc, a) => acc.plus(a.amount),
    new Prisma.Decimal(0),
  );
}

function mapAllocation(
  a: PaymentRow["allocations"][number],
): PaymentAllocationDetail {
  return {
    id: a.id,
    paymentId: a.paymentId,
    invoiceId: a.invoiceId,
    invoiceNumber: a.invoice?.number ?? null,
    amount: decToString(a.amount),
    createdAt: a.createdAt.toISOString(),
  };
}

function mapListItem(p: PaymentRow): PaymentListItem {
  const allocated = sumAllocations(p.allocations);
  const unallocated = p.amount.minus(allocated);
  return {
    id: p.id,
    factoryId: p.factoryId,
    customerId: p.customerId,
    customerName: p.customer?.name ?? null,
    kind: p.kind as PaymentKind,
    method: p.method as PaymentMethod,
    reference: p.reference ?? null,
    receivedAt: p.receivedAt.toISOString(),
    amount: decToString(p.amount),
    allocatedAmount: decToString(allocated),
    unallocatedAmount: decToString(unallocated),
    currency: p.currency,
    notes: p.notes ?? null,
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
    recordedById: p.recordedById ?? null,
    recordedByName: displayName(p.recordedBy),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function mapDetail(p: PaymentRow): PaymentDetail {
  return {
    ...mapListItem(p),
    allocations: p.allocations.map(mapAllocation),
  };
}

export interface PaymentListFilters {
  customerId?: string;
  kind?: PaymentKind;
  from?: Date;
  to?: Date;
  /** "active" excludes soft-deleted (default), "all" includes them, "deleted" returns only deleted */
  deletedFilter?: "active" | "all" | "deleted";
  take?: number;
  skip?: number;
}

const PAYMENT_DEFAULT_TAKE = 50;
const PAYMENT_MAX_TAKE = 200;

export interface PaymentWritable {
  customerId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  amount: Prisma.Decimal;
  notes: string | null;
}

export class PaymentRepository {
  async list(
    factoryId: string,
    filters: PaymentListFilters = {},
  ): Promise<PaymentListItem[]> {
    const where: Prisma.PaymentWhereInput = { factoryId };
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.kind) where.kind = filters.kind;
    if (filters.from || filters.to) {
      where.receivedAt = {};
      if (filters.from) (where.receivedAt as { gte?: Date }).gte = filters.from;
      if (filters.to) (where.receivedAt as { lte?: Date }).lte = filters.to;
    }
    const deletedFilter = filters.deletedFilter ?? "active";
    if (deletedFilter === "active") where.deletedAt = null;
    else if (deletedFilter === "deleted") where.deletedAt = { not: null };

    const rawTake = filters.take;
    const take =
      rawTake === undefined || !Number.isFinite(rawTake) || rawTake <= 0
        ? PAYMENT_DEFAULT_TAKE
        : Math.min(Math.floor(rawTake), PAYMENT_MAX_TAKE);
    const rawSkip = filters.skip;
    const skip =
      rawSkip === undefined || !Number.isFinite(rawSkip) || rawSkip < 0
        ? 0
        : Math.floor(rawSkip);

    const rows = await db.payment.findMany({
      where,
      include: DEFAULT_INCLUDE,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    });
    return rows.map(mapListItem);
  }

  async getById(
    factoryId: string,
    paymentId: string,
  ): Promise<PaymentDetail | null> {
    const row = await db.payment.findFirst({
      where: { id: paymentId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async getDetailInTx(
    tx: PrismaTransaction,
    factoryId: string,
    paymentId: string,
  ): Promise<PaymentDetail | null> {
    const row = await tx.payment.findFirst({
      where: { id: paymentId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async getRawById(
    tx: PrismaTransaction,
    factoryId: string,
    paymentId: string,
  ) {
    return tx.payment.findFirst({
      where: { id: paymentId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
  }

  async findCustomer(
    tx: PrismaTransaction,
    factoryId: string,
    customerId: string,
  ): Promise<{ id: string; name: string } | null> {
    return tx.customer.findFirst({
      where: { id: customerId, factoryId },
      select: { id: true, name: true },
    });
  }

  async create(
    tx: PrismaTransaction,
    factoryId: string,
    actorUserId: string,
    data: PaymentWritable,
  ): Promise<{ id: string }> {
    const created = await tx.payment.create({
      data: {
        factoryId,
        customerId: data.customerId,
        kind: data.kind,
        method: data.method,
        reference: data.reference,
        receivedAt: data.receivedAt,
        amount: data.amount,
        currency: "SAR",
        notes: data.notes,
        recordedById: actorUserId,
      },
      select: { id: true },
    });
    return created;
  }

  async update(
    tx: PrismaTransaction,
    factoryId: string,
    paymentId: string,
    data: {
      method?: PaymentMethod;
      reference?: string | null;
      notes?: string | null;
    },
  ): Promise<void> {
    const res = await tx.payment.updateMany({
      where: { id: paymentId, factoryId, deletedAt: null },
      data,
    });
    if (res.count === 0) throw new Error("Payment not found.");
  }

  async softDelete(
    tx: PrismaTransaction,
    factoryId: string,
    paymentId: string,
  ): Promise<{ id: string }> {
    const res = await tx.payment.updateMany({
      where: { id: paymentId, factoryId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new Error("Payment not found.");
    return { id: paymentId };
  }

  async createAllocation(
    tx: PrismaTransaction,
    paymentId: string,
    invoiceId: string,
    amount: Prisma.Decimal,
  ): Promise<{ id: string }> {
    return tx.paymentAllocation.create({
      data: { paymentId, invoiceId, amount },
      select: { id: true },
    });
  }

  async findAllocation(
    tx: PrismaTransaction,
    paymentId: string,
    allocationId: string,
  ): Promise<{ id: string; invoiceId: string; amount: Prisma.Decimal } | null> {
    return tx.paymentAllocation.findFirst({
      where: { id: allocationId, paymentId },
      select: { id: true, invoiceId: true, amount: true },
    });
  }

  async listAllocationsForPayment(
    tx: PrismaTransaction,
    paymentId: string,
  ): Promise<Array<{ id: string; invoiceId: string; amount: Prisma.Decimal }>> {
    return tx.paymentAllocation.findMany({
      where: { paymentId },
      select: { id: true, invoiceId: true, amount: true },
    });
  }

  async deleteAllocation(
    tx: PrismaTransaction,
    paymentId: string,
    allocationId: string,
  ): Promise<void> {
    const res = await tx.paymentAllocation.deleteMany({
      where: { id: allocationId, paymentId },
    });
    if (res.count === 0) throw new Error("Allocation not found.");
  }

  /**
   * Aggregate query for customer balance reporting.
   * Returns totals based on Invoice.total / Invoice.amountPaid for non-DRAFT,
   * non-VOID, non-deleted invoices.
   */
  async getCustomerBalance(
    factoryId: string,
    customerId: string,
  ): Promise<{
    totalInvoiced: Prisma.Decimal;
    totalPaid: Prisma.Decimal;
  }> {
    const agg = await db.invoice.aggregate({
      where: {
        factoryId,
        customerId,
        deletedAt: null,
        status: { notIn: ["DRAFT", "VOID"] },
      },
      _sum: { total: true, amountPaid: true },
    });
    return {
      totalInvoiced: agg._sum.total ?? new Prisma.Decimal(0),
      totalPaid: agg._sum.amountPaid ?? new Prisma.Decimal(0),
    };
  }
}
