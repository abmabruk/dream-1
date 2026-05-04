import "server-only";

import {
  Prisma,
  type CreditNoteStatus as PrismaCreditNoteStatus,
} from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import { decToString } from "@/lib/money";

import {
  type CreditNoteDetail,
  type CreditNoteLineDetail,
  type CreditNoteListItem,
  type CreditNoteStatus,
} from "./invoice.schemas";

export interface CreditNoteHeaderWritable {
  invoiceId: string;
  reason: string;
  taxRate: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface CreditNoteLineWritable {
  description: string;
  invoiceLineId: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
}

type CreditNoteRow = Prisma.CreditNoteGetPayload<{
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

function decToString4(v: Prisma.Decimal | null | undefined): string {
  if (v === null || v === undefined) return "0.0000";
  return v.toFixed(4);
}

function mapLine(line: CreditNoteRow["lines"][number]): CreditNoteLineDetail {
  return {
    id: line.id,
    creditNoteId: line.creditNoteId,
    sortOrder: line.sortOrder,
    invoiceLineId: line.invoiceLineId ?? null,
    description: line.description,
    quantity: decToString4(line.quantity),
    unitPrice: decToString4(line.unitPrice),
    lineTotal: decToString(line.lineTotal),
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

function mapListItem(cn: CreditNoteRow): CreditNoteListItem {
  return {
    id: cn.id,
    factoryId: cn.factoryId,
    invoiceId: cn.invoiceId,
    number: cn.number,
    numberSeq: cn.numberSeq,
    status: cn.status as CreditNoteStatus,
    reason: cn.reason,
    currency: cn.currency,
    taxRate: cn.taxRate.toFixed(2),
    subtotal: decToString(cn.subtotal),
    taxAmount: decToString(cn.taxAmount),
    total: decToString(cn.total),
    issuedAt: cn.issuedAt ? cn.issuedAt.toISOString() : null,
    voidedAt: cn.voidedAt ? cn.voidedAt.toISOString() : null,
    deletedAt: cn.deletedAt ? cn.deletedAt.toISOString() : null,
    createdById: cn.createdById ?? null,
    createdByName: displayName(cn.createdBy),
    createdAt: cn.createdAt.toISOString(),
    updatedAt: cn.updatedAt.toISOString(),
  };
}

function mapDetail(cn: CreditNoteRow): CreditNoteDetail {
  const lines = [...cn.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapLine);
  return { ...mapListItem(cn), lines };
}

export class CreditNoteRepository {
  async listByInvoice(
    factoryId: string,
    invoiceId: string,
  ): Promise<CreditNoteListItem[]> {
    const rows = await db.creditNote.findMany({
      where: { factoryId, invoiceId, deletedAt: null },
      include: DEFAULT_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    });
    return rows.map(mapListItem);
  }

  async getById(
    factoryId: string,
    creditNoteId: string,
  ): Promise<CreditNoteDetail | null> {
    const row = await db.creditNote.findFirst({
      where: { id: creditNoteId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
    return row ? mapDetail(row) : null;
  }

  async getRawById(
    tx: PrismaTransaction,
    factoryId: string,
    creditNoteId: string,
  ) {
    return tx.creditNote.findFirst({
      where: { id: creditNoteId, factoryId, deletedAt: null },
      include: DEFAULT_INCLUDE,
    });
  }

  async findInvoice(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
  ): Promise<{ id: string; status: string } | null> {
    return tx.invoice.findFirst({
      where: { id: invoiceId, factoryId, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  async acquireNumberLock(
    tx: PrismaTransaction,
    factoryId: string,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `credit_note_seq:${factoryId}`,
    );
  }

  async getLastNumberSeq(
    tx: PrismaTransaction,
    factoryId: string,
  ): Promise<number> {
    const last = await tx.creditNote.findFirst({
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
      header: CreditNoteHeaderWritable;
      lines: CreditNoteLineWritable[];
      placeholderNumber: string;
      placeholderSeq: number;
    },
  ): Promise<CreditNoteDetail> {
    const created = await tx.creditNote.create({
      data: {
        factoryId,
        invoiceId: args.header.invoiceId,
        number: args.placeholderNumber,
        numberSeq: args.placeholderSeq,
        status: "DRAFT",
        reason: args.header.reason,
        currency: "SAR",
        taxRate: args.header.taxRate,
        subtotal: args.header.subtotal,
        taxAmount: args.header.taxAmount,
        total: args.header.total,
        createdById: actorUserId,
        lines: {
          create: args.lines.map((l) => ({
            sortOrder: l.sortOrder,
            invoiceLineId: l.invoiceLineId,
            description: l.description,
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

  async assignNumberAndIssue(
    tx: PrismaTransaction,
    creditNoteId: string,
    args: { number: string; numberSeq: number; issuedAt: Date },
  ): Promise<CreditNoteDetail> {
    const updated = await tx.creditNote.update({
      where: { id: creditNoteId },
      data: {
        status: "ISSUED",
        number: args.number,
        numberSeq: args.numberSeq,
        issuedAt: args.issuedAt,
      },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }

  async setStatus(
    tx: PrismaTransaction,
    creditNoteId: string,
    status: PrismaCreditNoteStatus,
    extra: { voidedAt?: Date | null } = {},
  ): Promise<CreditNoteDetail> {
    const updated = await tx.creditNote.update({
      where: { id: creditNoteId },
      data: { status, ...extra },
      include: DEFAULT_INCLUDE,
    });
    return mapDetail(updated);
  }
}
