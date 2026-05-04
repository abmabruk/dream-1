import "server-only";

import { Prisma, type UserRole } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { db, type PrismaTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { computeTax, lineTotal, roundMoney, sumMoney } from "@/lib/money";
import { hasPermission } from "@/modules/auth/roles";
import {
  emitNotifications,
  findFactoryUsersByRole,
} from "@/modules/notifications/notification.emitter";

import {
  CreateInvoiceInput,
  InvoiceLineInput,
  UpdateInvoiceInput,
  type CreateInvoiceInputType,
  type InvoiceDetail,
  type InvoiceLineInputType,
  type InvoiceListItem,
  type InvoiceStatus,
  type UpdateInvoiceInputType,
} from "./invoice.schemas";
import {
  InvoiceRepository,
  type InvoiceHeaderWritable,
  type InvoiceLineWritable,
  type InvoiceListFilters,
} from "./invoice.repository";

type Actor = { userId: string; role: UserRole };

interface RawInvoice {
  id: string;
  factoryId: string;
  customerId: string;
  orderId: string | null;
  quoteId: string | null;
  number: string;
  numberSeq: number;
  status: string;
  taxRate: Prisma.Decimal;
  taxInclusive: boolean;
  discountAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  dueDate: Date | null;
  notes: string | null;
  internalNotes: string | null;
  updatedAt: Date;
  lines: Array<{
    id: string;
    sortOrder: number;
    productId: string | null;
    quoteLineId: string | null;
    description: string;
    sku: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
}

const DEFAULT_TAX_RATE = new Prisma.Decimal("15.00");
const ZERO = new Prisma.Decimal(0);

function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

export interface InvoiceListOptions {
  customerId?: string;
  status?: InvoiceStatus;
  from?: Date | string;
  to?: Date | string;
  deletedFilter?: "active" | "all" | "deleted";
  take?: number;
  skip?: number;
}

export class InvoiceService {
  constructor(private readonly repository = new InvoiceRepository()) {}

  // ---------- Permission gates ----------
  private assertView(role: UserRole) {
    if (!hasPermission(role, "invoices:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض الفواتير.");
    }
  }
  private assertManage(role: UserRole) {
    if (!hasPermission(role, "invoices:manage")) {
      throw new HttpError(403, "ليس لديك صلاحية تحرير الفواتير.");
    }
  }
  private assertIssue(role: UserRole) {
    if (!hasPermission(role, "invoices:issue")) {
      throw new HttpError(403, "ليس لديك صلاحية إصدار الفواتير.");
    }
  }
  private assertVoid(role: UserRole) {
    if (!hasPermission(role, "invoices:void")) {
      throw new HttpError(403, "ليس لديك صلاحية إلغاء الفواتير.");
    }
  }
  private assertDraftOnly(invoice: { status: string }) {
    if (invoice.status !== "DRAFT") {
      throw new HttpError(409, "لا يمكن تعديل الفاتورة إلا في حالة المسودة.");
    }
  }

  // ---------- Read ----------
  async list(
    factoryId: string,
    role: UserRole,
    opts: InvoiceListOptions = {},
  ): Promise<InvoiceListItem[]> {
    this.assertView(role);
    const filters: InvoiceListFilters = {
      customerId: opts.customerId,
      status: opts.status,
      from: opts.from ? new Date(opts.from) : undefined,
      to: opts.to ? new Date(opts.to) : undefined,
      deletedFilter: opts.deletedFilter,
      take: opts.take,
      skip: opts.skip,
    };
    return this.repository.list(factoryId, filters);
  }

  async getById(
    factoryId: string,
    role: UserRole,
    invoiceId: string,
  ): Promise<InvoiceDetail> {
    this.assertView(role);
    const invoice = await this.repository.getById(factoryId, invoiceId);
    if (!invoice) throw new HttpError(404, "الفاتورة غير موجودة.");
    return invoice;
  }

  // ---------- Create ----------
  async create(
    factoryId: string,
    actor: Actor,
    input: unknown,
  ): Promise<InvoiceDetail> {
    this.assertManage(actor.role);
    const parsed = CreateInvoiceInput.parse(input) as CreateInvoiceInputType;

    return db.$transaction(async (tx) => {
      const customer = await this.repository.findCustomer(
        tx,
        factoryId,
        parsed.customerId,
      );
      if (!customer) throw new HttpError(404, "العميل غير موجود.");

      if (parsed.orderId) {
        const order = await this.repository.findOrder(
          tx,
          factoryId,
          parsed.orderId,
        );
        if (!order) throw new HttpError(404, "الطلب غير موجود.");
      }

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

      const header: InvoiceHeaderWritable = {
        customerId: parsed.customerId,
        orderId: parsed.orderId ?? null,
        quoteId: parsed.quoteId ?? null,
        taxRate,
        taxInclusive,
        subtotal: totals.subtotal,
        discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        notes: parsed.notes ?? null,
        internalNotes: parsed.internalNotes ?? null,
      };

      const placeholder = this.draftPlaceholder();
      return this.repository.createDraft(tx, factoryId, actor.userId, {
        header,
        lines: writableLines,
        placeholderNumber: placeholder.number,
        placeholderSeq: placeholder.seq,
      });
    });
  }

  async generateFromQuote(
    factoryId: string,
    actor: Actor,
    quoteId: string,
    opts: { dueDate?: Date | string; orderId?: string } = {},
  ): Promise<InvoiceDetail> {
    this.assertManage(actor.role);

    return db.$transaction(async (tx) => {
      const quote = await this.repository.findQuoteWithLines(
        tx,
        factoryId,
        quoteId,
      );
      if (!quote) throw new HttpError(404, "عرض السعر غير موجود.");
      if (quote.status !== "APPROVED") {
        throw new HttpError(409, "لا يمكن إنشاء فاتورة إلا من عرض سعر معتمد.");
      }

      const orderId = opts.orderId ?? quote.orderId;
      const order = await this.repository.findOrder(tx, factoryId, orderId);
      if (!order) throw new HttpError(404, "الطلب غير موجود.");

      const customerId = order.customerId;
      const customer = await this.repository.findCustomer(
        tx,
        factoryId,
        customerId,
      );
      if (!customer) throw new HttpError(404, "العميل غير موجود.");

      const writableLines: InvoiceLineWritable[] = [...quote.lines]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l, index) => ({
          description: l.description,
          productId: l.productId ?? null,
          sku: l.sku ?? null,
          quoteLineId: l.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: lineTotal(l.quantity, l.unitPrice),
          sortOrder: index,
        }));

      const taxRate = quote.taxRate;
      const taxInclusive = quote.taxInclusive;
      const discountAmount = roundMoney(quote.discountAmount);
      const totals = this.computeTotals({
        lines: writableLines,
        discountAmount,
        taxRate,
        taxInclusive,
      });

      const header: InvoiceHeaderWritable = {
        customerId,
        orderId,
        quoteId: quote.id,
        taxRate,
        taxInclusive,
        subtotal: totals.subtotal,
        discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        dueDate: opts.dueDate ? new Date(opts.dueDate) : null,
        notes: quote.notes ?? null,
        internalNotes: quote.internalNotes ?? null,
      };

      const placeholder = this.draftPlaceholder();
      return this.repository.createDraft(tx, factoryId, actor.userId, {
        header,
        lines: writableLines,
        placeholderNumber: placeholder.number,
        placeholderSeq: placeholder.seq,
      });
    });
  }

  // ---------- Update header ----------
  async update(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    input: unknown,
  ): Promise<InvoiceDetail> {
    this.assertManage(actor.role);
    const parsed = UpdateInvoiceInput.parse(input) as UpdateInvoiceInputType;

    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      this.assertDraftOnly(existing);
      if (
        parsed.expectedUpdatedAt &&
        existing.updatedAt.toISOString() !== parsed.expectedUpdatedAt
      ) {
        throw new HttpError(
          409,
          "تم تعديل الفاتورة من جهة أخرى. أعد تحميل الصفحة.",
        );
      }

      const taxRate =
        parsed.taxRate !== undefined
          ? new Prisma.Decimal(parsed.taxRate)
          : existing.taxRate;
      const taxInclusive = parsed.taxInclusive ?? existing.taxInclusive;
      const discountAmount =
        parsed.discountAmount !== undefined
          ? roundMoney(parsed.discountAmount)
          : existing.discountAmount;
      const dueDate =
        parsed.dueDate !== undefined
          ? parsed.dueDate
            ? new Date(parsed.dueDate)
            : null
          : existing.dueDate;
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
              quoteLineId: l.quoteLineId,
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

      return this.repository.updateHeaderAndLines(tx, factoryId, invoiceId, {
        header: {
          taxRate,
          taxInclusive,
          subtotal: totals.subtotal,
          discountAmount,
          taxAmount: totals.taxAmount,
          total: totals.total,
          dueDate,
          notes,
          internalNotes,
        },
        replaceLines: parsed.lines !== undefined ? writableLines : undefined,
      });
    });
  }

  // ---------- Lines ----------
  async addLine(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    input: unknown,
  ): Promise<InvoiceDetail> {
    this.assertManage(actor.role);
    const parsed = InvoiceLineInput.parse(input) as InvoiceLineInputType;
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      this.assertDraftOnly(existing);
      const sortOrder = parsed.sortOrder ?? existing.lines.length;
      await this.repository.addLine(
        tx,
        invoiceId,
        this.buildWritableLine(parsed, sortOrder),
      );
      await this.recomputeAndPersist(tx, factoryId, invoiceId);
      return this.requireById(tx, factoryId, invoiceId);
    });
  }

  async updateLine(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    lineId: string,
    input: unknown,
  ): Promise<InvoiceDetail> {
    this.assertManage(actor.role);
    const parsed = InvoiceLineInput.parse(input) as InvoiceLineInputType;
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      this.assertDraftOnly(existing);
      const current = existing.lines.find((l) => l.id === lineId);
      if (!current) throw new HttpError(404, "بند الفاتورة غير موجود.");
      const sortOrder = parsed.sortOrder ?? current.sortOrder;
      await this.repository.updateLine(
        tx,
        invoiceId,
        lineId,
        this.buildWritableLine(parsed, sortOrder),
      );
      await this.recomputeAndPersist(tx, factoryId, invoiceId);
      return this.requireById(tx, factoryId, invoiceId);
    });
  }

  async deleteLine(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    lineId: string,
  ): Promise<InvoiceDetail> {
    this.assertManage(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      this.assertDraftOnly(existing);
      await this.repository.deleteLine(tx, invoiceId, lineId);
      await this.recomputeAndPersist(tx, factoryId, invoiceId);
      return this.requireById(tx, factoryId, invoiceId);
    });
  }

  // ---------- Lifecycle ----------
  async send(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
  ): Promise<InvoiceDetail> {
    this.assertIssue(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      if (existing.status !== "DRAFT") {
        throw new HttpError(409, "حالة غير صالحة للإرسال.");
      }
      if (existing.lines.length === 0) {
        throw new HttpError(409, "لا يمكن إرسال فاتورة بدون بنود.");
      }

      // Sequential numbering — advisory lock scoped to the transaction.
      await this.repository.acquireNumberLock(tx, factoryId);
      const lastSeq = await this.repository.getLastNumberSeq(tx, factoryId);
      // Skip placeholder values used by DRAFT rows (negative/zero seqs).
      const numberSeq = Math.max(lastSeq, 0) + 1;
      const year = new Date().getFullYear();
      const number = `INV-${year}-${pad5(numberSeq)}`;

      const factory = await this.repository.findFactory(tx, factoryId);
      const customer = await this.repository.findCustomer(
        tx,
        factoryId,
        existing.customerId,
      );

      const sent = await this.repository.assignNumberAndSend(tx, invoiceId, {
        number,
        numberSeq,
        sentAt: new Date(),
        sellerNameSnapshot: factory?.name ?? null,
        sellerTaxNumberSnapshot: factory?.taxNumber ?? null,
        sellerAddressSnapshot: factory?.address ?? null,
        buyerNameSnapshot: customer?.name ?? null,
        buyerTaxNumberSnapshot: customer?.taxNumber ?? null,
        buyerAddressSnapshot: customer?.address ?? null,
      });
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "INVOICE_SENT",
        entityType: "Invoice",
        entityId: invoiceId,
        metadata: {
          number,
          numberSeq,
          customerId: existing.customerId,
          total: sent.total.toString(),
        },
      });

      // Notify accountants of the newly issued invoice.
      const accountants = await findFactoryUsersByRole(
        factoryId,
        ["ACCOUNTANT", "OWNER", "FACTORY_MANAGER"],
        tx,
      );
      const customerName = customer?.name ?? "";
      await emitNotifications(
        accountants
          .filter((u) => u.id !== actor.userId)
          .map((u) => ({
            factoryId,
            userId: u.id,
            type: "INVOICE_SENT" as const,
            dedupeKey: `INVOICE_SENT:${invoiceId}`,
            title: `تم إصدار الفاتورة ${number}`,
            message: `تم إصدار الفاتورة ${number} للعميل ${customerName} بقيمة ${sent.total.toString()}.`,
            href: `/app/invoices/${invoiceId}`,
            entityType: "INVOICE",
            entityId: invoiceId,
          })),
        tx,
      );

      return sent;
    });
  }

  async void(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    reason: string,
  ): Promise<InvoiceDetail> {
    this.assertVoid(actor.role);
    if (!reason || reason.trim().length === 0) {
      throw new HttpError(400, "يجب توضيح سبب الإلغاء.");
    }
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      if (existing.status === "VOID") {
        throw new HttpError(409, "الفاتورة ملغاة بالفعل.");
      }
      const voided = await this.repository.setStatus(tx, invoiceId, "VOID", {
        voidedAt: new Date(),
        voidedReason: reason.trim(),
      });
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "INVOICE_VOIDED",
        entityType: "Invoice",
        entityId: invoiceId,
        metadata: {
          number: existing.number,
          previousStatus: existing.status,
          reason: reason.trim(),
        },
      });
      return voided;
    });
  }

  async softDelete(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
  ): Promise<{ id: string }> {
    this.assertManage(actor.role);
    return db.$transaction(async (tx) => {
      const existing = (await this.repository.getRawById(
        tx,
        factoryId,
        invoiceId,
      )) as RawInvoice | null;
      if (!existing) throw new HttpError(404, "الفاتورة غير موجودة.");
      if (existing.status !== "DRAFT") {
        throw new HttpError(409, "لا يمكن حذف فاتورة بعد إصدارها.");
      }
      return this.repository.softDelete(tx, factoryId, invoiceId);
    });
  }

  /**
   * Helper used by Phase 4b Payments. Caller MUST already be inside a
   * transaction and have validated the payment amount upstream. Returns the
   * resulting status + amountPaid so the caller can react.
   */
  async applyPayment(
    tx: PrismaTransaction,
    invoiceId: string,
    amount: Prisma.Decimal,
  ): Promise<{ status: InvoiceStatus; amountPaid: Prisma.Decimal }> {
    if (amount.lte(0)) {
      throw new HttpError(400, "قيمة الدفعة يجب أن تكون أكبر من صفر.");
    }
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        factoryId: true,
        number: true,
        status: true,
        total: true,
        amountPaid: true,
        createdById: true,
        deletedAt: true,
      },
    });
    if (!invoice || invoice.deletedAt) {
      throw new HttpError(404, "الفاتورة غير موجودة.");
    }
    if (invoice.status === "DRAFT") {
      throw new HttpError(409, "لا يمكن تسجيل دفعة على فاتورة مسودة.");
    }
    if (invoice.status === "VOID") {
      throw new HttpError(409, "لا يمكن تسجيل دفعة على فاتورة ملغاة.");
    }
    if (invoice.status === "PAID") {
      throw new HttpError(409, "الفاتورة مدفوعة بالكامل.");
    }

    const newAmountPaid = roundMoney(invoice.amountPaid.plus(amount));
    let nextStatus: PrismaInvoiceStatusLocal = invoice.status;
    if (newAmountPaid.gte(invoice.total)) {
      nextStatus = "PAID";
    } else if (newAmountPaid.gt(0)) {
      nextStatus = "PARTIALLY_PAID";
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: nextStatus,
      },
    });

    // Notify on full payment — invoice creator + accountants.
    if (nextStatus === "PAID") {
      const recipients = new Set<string>();
      if (invoice.createdById) recipients.add(invoice.createdById);
      const accountants = await findFactoryUsersByRole(
        invoice.factoryId,
        ["ACCOUNTANT", "OWNER", "FACTORY_MANAGER"],
        tx,
      );
      for (const a of accountants) recipients.add(a.id);
      await emitNotifications(
        Array.from(recipients).map((userId) => ({
          factoryId: invoice.factoryId,
          userId,
          type: "INVOICE_PAID" as const,
          dedupeKey: `INVOICE_PAID:${invoiceId}`,
          title: `تم سداد الفاتورة ${invoice.number}`,
          message: `تم سداد الفاتورة ${invoice.number} بالكامل بقيمة ${invoice.total.toString()}.`,
          href: `/app/invoices/${invoiceId}`,
          entityType: "INVOICE",
          entityId: invoiceId,
        })),
        tx,
      );
    }

    return { status: nextStatus as InvoiceStatus, amountPaid: newAmountPaid };
  }

  // ---------- Internals ----------
  private buildWritableLine(
    input: InvoiceLineInputType,
    sortOrder: number,
  ): InvoiceLineWritable {
    const quantity = new Prisma.Decimal(input.quantity);
    const unitPrice = new Prisma.Decimal(input.unitPrice);
    return {
      description: input.description,
      productId: input.productId ?? null,
      sku: input.sku ?? null,
      quoteLineId: input.quoteLineId ?? null,
      quantity,
      unitPrice,
      lineTotal: lineTotal(quantity, unitPrice),
      sortOrder,
    };
  }

  private buildWritableLines(
    inputs: InvoiceLineInputType[],
  ): InvoiceLineWritable[] {
    return inputs.map((line, index) =>
      this.buildWritableLine(line, line.sortOrder ?? index),
    );
  }

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
    let preTax = roundMoney(linesSum.minus(args.discountAmount));
    if (preTax.lt(0)) preTax = ZERO;
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
    invoiceId: string,
  ): Promise<void> {
    const fresh = (await this.repository.getRawById(
      tx,
      factoryId,
      invoiceId,
    )) as RawInvoice | null;
    if (!fresh) throw new HttpError(404, "الفاتورة غير موجودة.");
    const totals = this.computeTotals({
      lines: fresh.lines,
      discountAmount: fresh.discountAmount,
      taxRate: fresh.taxRate,
      taxInclusive: fresh.taxInclusive,
    });
    await this.repository.updateTotals(tx, invoiceId, totals);
  }

  private async requireById(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
  ): Promise<InvoiceDetail> {
    const inv = await this.repository.getDetailInTx(tx, factoryId, invoiceId);
    if (!inv) throw new HttpError(404, "الفاتورة غير موجودة.");
    return inv;
  }

  /**
   * DRAFT invoices need a non-null `number` to satisfy the schema, but we
   * MUST NOT consume the production sequence — that would create gaps when a
   * DRAFT is deleted. We use a per-row uuid suffix and a sentinel seq=0 so the
   * (factoryId, number) unique constraint is respected. Real numbering is
   * assigned in send() under an advisory lock.
   */
  private draftPlaceholder(): { number: string; seq: number } {
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    return { number: `DRAFT-${ts}-${rand}`, seq: 0 };
  }
}

// Local alias to avoid widening — Prisma's enum is the source of truth.
type PrismaInvoiceStatusLocal =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";
