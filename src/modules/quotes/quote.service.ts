import "server-only";

import { Prisma, type UserRole } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { db, type PrismaTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { computeTax, lineTotal, roundMoney, sumMoney } from "@/lib/money";
import { hasPermission } from "@/modules/auth/roles";
import { emitNotification } from "@/modules/notifications/notification.emitter";

import {
  CreateQuoteInput,
  type CreateQuoteInputType,
  QuoteLineInput,
  type QuoteLineInputType,
  UpdateQuoteInput,
  type UpdateQuoteInputType,
  type QuoteDetail,
  type QuoteListItem,
} from "./quote.schemas";
import {
  QuoteRepository,
  type QuoteHeaderWritable,
  type QuoteLineWritable,
} from "./quote.repository";

type Actor = { userId: string; role: UserRole };

interface RawQuote {
  id: string;
  factoryId: string;
  orderId: string;
  status: string;
  taxRate: Prisma.Decimal;
  taxInclusive: boolean;
  discountAmount: Prisma.Decimal;
  discountReason: string | null;
  validUntil: Date | null;
  notes: string | null;
  internalNotes: string | null;
  updatedAt: Date;
  total: Prisma.Decimal;
  version: number;
  parentQuoteId: string | null;
  lines: Array<{
    id: string;
    sortOrder: number;
    productId: string | null;
    description: string;
    sku: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
}

const DEFAULT_TAX_RATE = new Prisma.Decimal("15.00");

export class QuoteService {
  constructor(private readonly repository = new QuoteRepository()) {}

  // ---------------------------------------------------------------------------
  // Permission gates
  // ---------------------------------------------------------------------------

  private assertView(role: UserRole) {
    if (!hasPermission(role, "quotes:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض عروض الأسعار.");
    }
  }

  private assertDraft(role: UserRole) {
    if (!hasPermission(role, "quotes:draft")) {
      throw new HttpError(403, "ليس لديك صلاحية تحرير عروض الأسعار.");
    }
  }

  private assertApprove(role: UserRole) {
    if (!hasPermission(role, "quotes:approve")) {
      throw new HttpError(403, "ليس لديك صلاحية اعتماد عروض الأسعار.");
    }
  }

  private assertCancel(role: UserRole) {
    if (!hasPermission(role, "quotes:cancel")) {
      throw new HttpError(403, "ليس لديك صلاحية إلغاء عروض الأسعار.");
    }
  }

  private assertDraftOnly(quote: { status: string }) {
    if (quote.status !== "DRAFT") {
      throw new HttpError(409, "لا يمكن تعديل عرض السعر إلا في حالة المسودة.");
    }
  }

  private assertOptimistic(
    quote: { updatedAt: Date },
    expected: string | undefined,
  ) {
    if (!expected) return;
    if (quote.updatedAt.toISOString() !== expected) {
      throw new HttpError(
        409,
        "تم تعديل عرض السعر من جهة أخرى. أعد تحميل الصفحة.",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async listByOrder(
    factoryId: string,
    role: UserRole,
    orderId: string,
  ): Promise<QuoteListItem[]> {
    this.assertView(role);
    return this.repository.listByOrder(factoryId, orderId);
  }

  async getById(
    factoryId: string,
    role: UserRole,
    quoteId: string,
  ): Promise<QuoteDetail> {
    this.assertView(role);
    const quote = await this.repository.getById(factoryId, quoteId);
    if (!quote) {
      throw new HttpError(404, "عرض السعر غير موجود.");
    }
    return quote;
  }

  // ---------------------------------------------------------------------------
  // Mutate — header
  // ---------------------------------------------------------------------------

  async create(
    factoryId: string,
    actor: Actor,
    input: unknown,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    const parsed = CreateQuoteInput.parse(input);

    return db.$transaction(async (tx) => {
      const order = await this.repository.findOrder(
        tx,
        factoryId,
        parsed.orderId,
      );
      if (!order) {
        throw new HttpError(404, "الطلب غير موجود.");
      }

      const version = await this.repository.nextVersionForOrder(
        tx,
        factoryId,
        parsed.orderId,
      );

      const taxRate =
        parsed.taxRate !== undefined
          ? new Prisma.Decimal(parsed.taxRate)
          : DEFAULT_TAX_RATE;
      const taxInclusive = parsed.taxInclusive ?? false;
      const discountAmount = roundMoney(parsed.discountAmount ?? 0);

      const writableLines = this.buildWritableLines(parsed.lines);
      const totals = this.computeTotals({
        lines: writableLines,
        discountAmount,
        taxRate,
        taxInclusive,
      });

      const header: QuoteHeaderWritable = {
        taxRate,
        taxInclusive,
        subtotal: totals.subtotal,
        discountAmount,
        discountReason: parsed.discountReason ?? null,
        taxAmount: totals.taxAmount,
        total: totals.total,
        validUntil: parsed.validUntil ? new Date(parsed.validUntil) : null,
        notes: parsed.notes ?? null,
        internalNotes: parsed.internalNotes ?? null,
      };

      return this.repository.createWithLines(tx, factoryId, actor.userId, {
        orderId: parsed.orderId,
        version,
        parentQuoteId: null,
        header,
        lines: writableLines,
      });
    });
  }

  async update(
    factoryId: string,
    actor: Actor,
    quoteId: string,
    input: unknown,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    const parsed = UpdateQuoteInput.parse(input);

    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) {
        throw new HttpError(404, "عرض السعر غير موجود.");
      }
      this.assertDraftOnly(existing);
      this.assertOptimistic(existing, parsed.expectedUpdatedAt);

      const taxRate =
        parsed.taxRate !== undefined
          ? new Prisma.Decimal(parsed.taxRate)
          : existing.taxRate;
      const taxInclusive = parsed.taxInclusive ?? existing.taxInclusive;
      const discountAmount =
        parsed.discountAmount !== undefined
          ? roundMoney(parsed.discountAmount)
          : existing.discountAmount;
      const discountReason =
        parsed.discountReason !== undefined
          ? parsed.discountReason
          : existing.discountReason;
      const validUntil =
        parsed.validUntil !== undefined
          ? parsed.validUntil
            ? new Date(parsed.validUntil)
            : null
          : existing.validUntil;
      const notes = parsed.notes !== undefined ? parsed.notes : existing.notes;
      const internalNotes =
        parsed.internalNotes !== undefined
          ? parsed.internalNotes
          : existing.internalNotes;

      const writableLines =
        parsed.lines !== undefined
          ? this.buildWritableLines(parsed.lines)
          : existing.lines.map((l) => ({
              description: l.description,
              productId: l.productId,
              sku: l.sku,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
              sortOrder: l.sortOrder,
            }));

      const totals = this.computeTotals({
        lines: writableLines,
        discountAmount,
        taxRate,
        taxInclusive,
      });

      const header: QuoteHeaderWritable = {
        taxRate,
        taxInclusive,
        subtotal: totals.subtotal,
        discountAmount,
        discountReason,
        taxAmount: totals.taxAmount,
        total: totals.total,
        validUntil,
        notes,
        internalNotes,
      };

      return this.repository.updateWithLines(tx, factoryId, quoteId, {
        header,
        replaceLines: parsed.lines !== undefined ? writableLines : undefined,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  async send(
    factoryId: string,
    actor: Actor,
    quoteId: string,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      if (existing.status !== "DRAFT") {
        throw new HttpError(409, "حالة غير صالحة للعملية");
      }
      if (existing.lines.length === 0) {
        throw new HttpError(409, "لا يمكن إرسال عرض سعر بدون بنود.");
      }
      const sent = await this.repository.setStatus(tx, quoteId, "SENT", {
        sentToCustomerAt: new Date(),
      });
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "QUOTE_SENT",
        entityType: "Quote",
        entityId: quoteId,
        metadata: { version: existing.version, total: sent.total.toString() },
      });
      return sent;
    });
  }

  async approve(
    factoryId: string,
    actor: Actor,
    quoteId: string,
  ): Promise<QuoteDetail> {
    this.assertApprove(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      if (existing.status !== "DRAFT" && existing.status !== "SENT") {
        throw new HttpError(409, "حالة غير صالحة للعملية");
      }
      if (existing.lines.length === 0) {
        throw new HttpError(409, "لا يمكن اعتماد عرض سعر بدون بنود.");
      }

      // 1. Supersede any other APPROVED quote(s) for the same order.
      await this.repository.supersedeApprovedSiblings(
        tx,
        factoryId,
        existing.orderId,
        quoteId,
      );

      // 2. Approve this quote.
      const approved = await this.repository.setStatus(
        tx,
        quoteId,
        "APPROVED",
        {
          approvedAt: new Date(),
          approvedById: actor.userId,
        },
      );

      // 3. Mirror total onto the Order.
      await this.repository.setOrderQuotedAmount(
        tx,
        factoryId,
        existing.orderId,
        new Prisma.Decimal(approved.total),
      );

      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "QUOTE_APPROVED",
        entityType: "Quote",
        entityId: quoteId,
        metadata: {
          version: existing.version,
          orderId: existing.orderId,
          total: approved.total.toString(),
        },
      });

      // Notify the quote creator (if known and not the same as actor).
      const meta = await tx.quote.findUnique({
        where: { id: quoteId },
        select: {
          createdById: true,
          version: true,
          order: { select: { code: true } },
        },
      });
      if (meta?.createdById && meta.createdById !== actor.userId) {
        await emitNotification(
          {
            factoryId,
            userId: meta.createdById,
            type: "QUOTE_APPROVED",
            dedupeKey: `QUOTE_APPROVED:${quoteId}`,
            title: `تم اعتماد عرض السعر #${meta.version}`,
            message: `تم اعتماد عرض السعر #${meta.version} للطلب ${meta.order?.code ?? ""}.`,
            href: `/app/orders/${existing.orderId}`,
            entityType: "QUOTE",
            entityId: quoteId,
          },
          tx,
        );
      }

      return approved;
    });
  }

  async reject(
    factoryId: string,
    actor: Actor,
    quoteId: string,
  ): Promise<QuoteDetail> {
    this.assertApprove(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      if (existing.status !== "DRAFT" && existing.status !== "SENT") {
        throw new HttpError(409, "حالة غير صالحة للعملية");
      }
      const rejected = await this.repository.setStatus(tx, quoteId, "REJECTED");
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "QUOTE_REJECTED",
        entityType: "Quote",
        entityId: quoteId,
        metadata: { version: existing.version, orderId: existing.orderId },
      });

      const meta = await tx.quote.findUnique({
        where: { id: quoteId },
        select: {
          createdById: true,
          version: true,
          order: { select: { code: true } },
        },
      });
      if (meta?.createdById && meta.createdById !== actor.userId) {
        await emitNotification(
          {
            factoryId,
            userId: meta.createdById,
            type: "QUOTE_REJECTED",
            dedupeKey: `QUOTE_REJECTED:${quoteId}`,
            title: `تم رفض عرض السعر #${meta.version}`,
            message: `تم رفض عرض السعر #${meta.version} للطلب ${meta.order?.code ?? ""}.`,
            href: `/app/orders/${existing.orderId}`,
            entityType: "QUOTE",
            entityId: quoteId,
          },
          tx,
        );
      }

      return rejected;
    });
  }

  async cancel(
    factoryId: string,
    actor: Actor,
    quoteId: string,
  ): Promise<QuoteDetail> {
    this.assertCancel(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      if (
        existing.status !== "DRAFT" &&
        existing.status !== "SENT" &&
        existing.status !== "APPROVED"
      ) {
        throw new HttpError(409, "حالة غير صالحة للعملية");
      }

      // If the cancelled quote was the approved one, clear Order.quotedAmount.
      const wasApproved = existing.status === "APPROVED";
      const cancelled = await this.repository.setStatus(
        tx,
        quoteId,
        "CANCELLED",
      );
      if (wasApproved) {
        await tx.order.updateMany({
          where: { id: existing.orderId, factoryId },
          data: { quotedAmount: null },
        });
      }
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "QUOTE_CANCELLED",
        entityType: "Quote",
        entityId: quoteId,
        metadata: {
          version: existing.version,
          orderId: existing.orderId,
          previousStatus: existing.status,
          wasApproved,
        },
      });
      return cancelled;
    });
  }

  async duplicate(
    factoryId: string,
    actor: Actor,
    quoteId: string,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");

      const version = await this.repository.nextVersionForOrder(
        tx,
        factoryId,
        existing.orderId,
      );

      const writableLines: QuoteLineWritable[] = existing.lines
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l, index) => ({
          description: l.description,
          productId: l.productId,
          sku: l.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: lineTotal(l.quantity, l.unitPrice),
          sortOrder: index,
        }));

      const totals = this.computeTotals({
        lines: writableLines,
        discountAmount: existing.discountAmount,
        taxRate: existing.taxRate,
        taxInclusive: existing.taxInclusive,
      });

      const header: QuoteHeaderWritable = {
        taxRate: existing.taxRate,
        taxInclusive: existing.taxInclusive,
        subtotal: totals.subtotal,
        discountAmount: existing.discountAmount,
        discountReason: existing.discountReason,
        taxAmount: totals.taxAmount,
        total: totals.total,
        validUntil: existing.validUntil,
        notes: existing.notes,
        internalNotes: existing.internalNotes,
      };

      return this.repository.createWithLines(tx, factoryId, actor.userId, {
        orderId: existing.orderId,
        version,
        parentQuoteId: existing.id,
        header,
        lines: writableLines,
      });
    });
  }

  async softDelete(
    factoryId: string,
    actor: Actor,
    quoteId: string,
  ): Promise<{ id: string }> {
    this.assertDraft(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      if (
        existing.status !== "DRAFT" &&
        existing.status !== "REJECTED" &&
        existing.status !== "CANCELLED"
      ) {
        throw new HttpError(409, "لا يمكن حذف عرض سعر معتمد أو مُرسَل.");
      }
      return this.repository.softDelete(tx, factoryId, quoteId);
    });
  }

  // ---------------------------------------------------------------------------
  // Lines
  // ---------------------------------------------------------------------------

  async addLine(
    factoryId: string,
    actor: Actor,
    quoteId: string,
    input: unknown,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    const parsed = QuoteLineInput.parse(input);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      this.assertDraftOnly(existing);

      const sortOrder = parsed.sortOrder ?? existing.lines.length;
      const writable = this.buildWritableLine(parsed, sortOrder);
      await this.repository.addLine(tx, factoryId, quoteId, writable);
      await this.recomputeAndPersist(tx, factoryId, quoteId);
      return this.requireById(tx, factoryId, quoteId);
    });
  }

  async updateLine(
    factoryId: string,
    actor: Actor,
    quoteId: string,
    lineId: string,
    input: unknown,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    const parsed = QuoteLineInput.parse(input);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      this.assertDraftOnly(existing);

      const currentLine = existing.lines.find((l) => l.id === lineId);
      if (!currentLine) {
        throw new HttpError(404, "بند عرض السعر غير موجود.");
      }
      const sortOrder = parsed.sortOrder ?? currentLine.sortOrder;
      const writable = this.buildWritableLine(parsed, sortOrder);
      await this.repository.updateLine(
        tx,
        factoryId,
        quoteId,
        lineId,
        writable,
      );
      await this.recomputeAndPersist(tx, factoryId, quoteId);
      return this.requireById(tx, factoryId, quoteId);
    });
  }

  async deleteLine(
    factoryId: string,
    actor: Actor,
    quoteId: string,
    lineId: string,
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      this.assertDraftOnly(existing);

      await this.repository.deleteLine(tx, factoryId, quoteId, lineId);
      await this.recomputeAndPersist(tx, factoryId, quoteId);
      return this.requireById(tx, factoryId, quoteId);
    });
  }

  async reorderLines(
    factoryId: string,
    actor: Actor,
    quoteId: string,
    orderedLineIds: string[],
  ): Promise<QuoteDetail> {
    this.assertDraft(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        quoteId,
      )) as RawQuote | null;
      if (!existing) throw new HttpError(404, "عرض السعر غير موجود.");
      this.assertDraftOnly(existing);

      const existingIds = new Set(existing.lines.map((l) => l.id));
      const matches =
        orderedLineIds.length === existing.lines.length &&
        orderedLineIds.every((id) => existingIds.has(id));
      if (!matches) {
        throw new HttpError(400, "قائمة البنود غير متطابقة مع البنود الحالية.");
      }
      await this.repository.setLineSortOrders(
        tx,
        factoryId,
        quoteId,
        orderedLineIds,
      );
      return this.requireById(tx, factoryId, quoteId);
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildWritableLine(
    input: QuoteLineInputType,
    sortOrder: number,
  ): QuoteLineWritable {
    const quantity = new Prisma.Decimal(input.quantity);
    const unitPrice = new Prisma.Decimal(input.unitPrice);
    return {
      description: input.description,
      productId: input.productId ?? null,
      sku: input.sku ?? null,
      quantity,
      unitPrice,
      lineTotal: lineTotal(quantity, unitPrice),
      sortOrder,
    };
  }

  private buildWritableLines(
    inputs: QuoteLineInputType[],
  ): QuoteLineWritable[] {
    return inputs.map((line, index) =>
      this.buildWritableLine(line, line.sortOrder ?? index),
    );
  }

  /**
   * The single source of truth for quote totals. ALL math goes through
   * src/lib/money.ts (sumMoney / roundMoney / computeTax) — no raw arithmetic.
   */
  private computeTotals(args: {
    lines: Array<{ lineTotal: Prisma.Decimal }>;
    discountAmount: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxInclusive: boolean;
  }): {
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    total: Prisma.Decimal;
  } {
    const linesSum = sumMoney(args.lines.map((l) => l.lineTotal));
    // Subtotal = sum(line totals) - discount, floored at 0 to prevent negatives.
    let preTax = roundMoney(linesSum.minus(args.discountAmount));
    if (preTax.lt(0)) preTax = new Prisma.Decimal(0);
    const breakdown = computeTax(
      preTax,
      args.taxRate,
      args.taxInclusive ? "inclusive" : "exclusive",
    );
    return {
      subtotal: breakdown.subtotal,
      taxAmount: breakdown.taxAmount,
      total: breakdown.total,
    };
  }

  private async recomputeAndPersist(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ): Promise<void> {
    const fresh = (await this.repository.getRawById(
      tx,
      factoryId,
      quoteId,
    )) as RawQuote | null;
    if (!fresh) throw new HttpError(404, "عرض السعر غير موجود.");
    const totals = this.computeTotals({
      lines: fresh.lines,
      discountAmount: fresh.discountAmount,
      taxRate: fresh.taxRate,
      taxInclusive: fresh.taxInclusive,
    });
    await this.repository.updateTotals(tx, quoteId, totals);
  }

  private async requireById(
    tx: PrismaTransaction,
    factoryId: string,
    quoteId: string,
  ): Promise<QuoteDetail> {
    const quote = await this.repository.getDetailInTx(tx, factoryId, quoteId);
    if (!quote) throw new HttpError(404, "عرض السعر غير موجود.");
    return quote;
  }
}
