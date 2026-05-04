import "server-only";

import { Prisma, type UserRole } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { db, type PrismaTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import {
  decToString,
  parseMoneyInput,
  roundMoney,
  sumMoney,
} from "@/lib/money";
import { hasPermission } from "@/modules/auth/roles";
import { InvoiceService } from "@/modules/invoices/invoice.service";
import {
  emitNotifications,
  findFactoryUsersByRole,
} from "@/modules/notifications/notification.emitter";

import {
  PaymentRepository,
  type PaymentListFilters,
  type PaymentWritable,
} from "./payment.repository";
import {
  AllocationInput,
  RecordPaymentInput,
  UpdatePaymentInput,
  type AllocationInputType,
  type PaymentDetail,
  type PaymentKind,
  type PaymentListItem,
  type RecordPaymentInputType,
  type UpdatePaymentInputType,
} from "./payment.schemas";

type Actor = { userId: string; role: UserRole };

export interface PaymentListOptions {
  customerId?: string;
  kind?: PaymentKind;
  from?: Date | string;
  to?: Date | string;
  deletedFilter?: "active" | "all" | "deleted";
  take?: number;
  skip?: number;
}

export class PaymentService {
  constructor(
    private readonly repository = new PaymentRepository(),
    private readonly invoiceService = new InvoiceService(),
  ) {}

  // ---------- Permission gates ----------
  private assertView(role: UserRole) {
    if (!hasPermission(role, "payments:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض المدفوعات.");
    }
  }
  private assertManage(role: UserRole) {
    if (!hasPermission(role, "payments:manage")) {
      throw new HttpError(403, "ليس لديك صلاحية تحرير المدفوعات.");
    }
  }

  // ---------- Read ----------
  async list(
    factoryId: string,
    role: UserRole,
    opts: PaymentListOptions = {},
  ): Promise<PaymentListItem[]> {
    this.assertView(role);
    const filters: PaymentListFilters = {
      customerId: opts.customerId,
      kind: opts.kind,
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
    paymentId: string,
  ): Promise<PaymentDetail> {
    this.assertView(role);
    const payment = await this.repository.getById(factoryId, paymentId);
    if (!payment) throw new HttpError(404, "الدفعة غير موجودة.");
    return payment;
  }

  // ---------- Write ----------
  async record(
    factoryId: string,
    actor: Actor,
    input: unknown,
  ): Promise<PaymentDetail> {
    this.assertManage(actor.role);
    const parsed = RecordPaymentInput.parse(input) as RecordPaymentInputType;

    const amount = roundMoney(parseMoneyInput(parsed.amount));
    if (amount.lte(0)) {
      throw new HttpError(400, "قيمة الدفعة يجب أن تكون أكبر من صفر.");
    }

    const allocations = parsed.allocations ?? [];
    const allocAmounts = allocations.map((a) =>
      roundMoney(parseMoneyInput(a.amount)),
    );
    if (allocAmounts.some((a) => a.lte(0))) {
      throw new HttpError(400, "قيمة كل تخصيص يجب أن تكون أكبر من صفر.");
    }
    const allocSum = sumMoney(allocAmounts);
    if (allocSum.gt(amount)) {
      throw new HttpError(400, "مجموع تخصيصات الفواتير يتجاوز قيمة الدفعة.");
    }

    const kind = parsed.kind ?? "PAYMENT";
    const method = parsed.method ?? "BANK_TRANSFER";

    return db.$transaction(async (tx) => {
      const customer = await this.repository.findCustomer(
        tx,
        factoryId,
        parsed.customerId,
      );
      if (!customer) throw new HttpError(404, "العميل غير موجود.");

      const writable: PaymentWritable = {
        customerId: parsed.customerId,
        kind,
        method,
        reference: parsed.reference ?? null,
        receivedAt: parsed.receivedAt
          ? new Date(parsed.receivedAt)
          : new Date(),
        amount,
        notes: parsed.notes ?? null,
      };

      const created = await this.repository.create(
        tx,
        factoryId,
        actor.userId,
        writable,
      );

      // Apply each allocation. Validate invoice belongs to same customer + factory.
      for (let i = 0; i < allocations.length; i += 1) {
        const a = allocations[i];
        const amt = allocAmounts[i];
        await this.assertInvoiceForCustomer(
          tx,
          factoryId,
          a.invoiceId,
          parsed.customerId,
        );
        await this.repository.createAllocation(
          tx,
          created.id,
          a.invoiceId,
          amt,
        );
        if (kind === "REFUND") {
          await this.reverseInvoicePayment(tx, a.invoiceId, amt);
        } else {
          await this.invoiceService.applyPayment(tx, a.invoiceId, amt);
        }
      }

      const detail = await this.requireById(tx, factoryId, created.id);
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: created.id,
        metadata: {
          customerId: parsed.customerId,
          kind,
          method,
          amount: amount.toString(),
          allocationCount: allocations.length,
        },
      });

      // Notify accountants of incoming payments (skip refunds).
      if (kind === "PAYMENT") {
        const accountants = await findFactoryUsersByRole(
          factoryId,
          ["ACCOUNTANT", "OWNER", "FACTORY_MANAGER"],
          tx,
        );
        await emitNotifications(
          accountants
            .filter((u) => u.id !== actor.userId)
            .map((u) => ({
              factoryId,
              userId: u.id,
              type: "PAYMENT_RECEIVED" as const,
              dedupeKey: `PAYMENT_RECEIVED:${created.id}`,
              title: `تم استلام دفعة من ${customer.name}`,
              message: `تم تسجيل دفعة بقيمة ${amount.toString()} من ${customer.name}.`,
              href: `/app/payments/${created.id}`,
              entityType: "PAYMENT",
              entityId: created.id,
            })),
          tx,
        );
      }

      return detail;
    });
  }

  async update(
    factoryId: string,
    actor: Actor,
    paymentId: string,
    input: unknown,
  ): Promise<PaymentDetail> {
    this.assertManage(actor.role);
    const parsed = UpdatePaymentInput.parse(input) as UpdatePaymentInputType;
    return db.$transaction(async (tx) => {
      const existing = await this.repository.getRawById(
        tx,
        factoryId,
        paymentId,
      );
      if (!existing) throw new HttpError(404, "الدفعة غير موجودة.");
      await this.repository.update(tx, factoryId, paymentId, {
        method: parsed.method,
        reference:
          parsed.reference !== undefined ? parsed.reference : undefined,
        notes: parsed.notes !== undefined ? parsed.notes : undefined,
      });
      return this.requireById(tx, factoryId, paymentId);
    });
  }

  async softDelete(
    factoryId: string,
    actor: Actor,
    paymentId: string,
  ): Promise<{ id: string }> {
    this.assertManage(actor.role);
    return db.$transaction(async (tx) => {
      const existing = await this.repository.getRawById(
        tx,
        factoryId,
        paymentId,
      );
      if (!existing) throw new HttpError(404, "الدفعة غير موجودة.");

      const allocs = await this.repository.listAllocationsForPayment(
        tx,
        paymentId,
      );
      for (const a of allocs) {
        // Reverse the original effect: PAYMENT increased amountPaid, REFUND decreased.
        if (existing.kind === "REFUND") {
          // Re-apply the amount back to the invoice.
          await this.invoiceService.applyPayment(tx, a.invoiceId, a.amount);
        } else {
          await this.reverseInvoicePayment(tx, a.invoiceId, a.amount);
        }
      }

      const result = await this.repository.softDelete(tx, factoryId, paymentId);
      await recordAudit({
        factoryId,
        actorUserId: actor.userId,
        actorRoleSnapshot: actor.role,
        action: "PAYMENT_DELETED",
        entityType: "Payment",
        entityId: paymentId,
        metadata: {
          customerId: existing.customerId,
          kind: existing.kind,
          amount: existing.amount.toString(),
          reversedAllocations: allocs.length,
        },
      });
      return result;
    });
  }

  // ---------- Allocations ----------
  async allocate(
    factoryId: string,
    actor: Actor,
    paymentId: string,
    allocations: unknown,
  ): Promise<PaymentDetail> {
    this.assertManage(actor.role);
    const parsed = AllocationInput.array().parse(
      allocations,
    ) as AllocationInputType[];
    if (parsed.length === 0) {
      throw new HttpError(400, "لم يتم تقديم أي تخصيصات.");
    }
    const amounts = parsed.map((a) => roundMoney(parseMoneyInput(a.amount)));
    if (amounts.some((a) => a.lte(0))) {
      throw new HttpError(400, "قيمة كل تخصيص يجب أن تكون أكبر من صفر.");
    }

    return db.$transaction(async (tx) => {
      const existing = await this.repository.getRawById(
        tx,
        factoryId,
        paymentId,
      );
      if (!existing) throw new HttpError(404, "الدفعة غير موجودة.");

      const current = await this.repository.listAllocationsForPayment(
        tx,
        paymentId,
      );
      const currentSum = current.reduce<Prisma.Decimal>(
        (acc, a) => acc.plus(a.amount),
        new Prisma.Decimal(0),
      );
      const addSum = sumMoney(amounts);
      if (currentSum.plus(addSum).gt(existing.amount)) {
        throw new HttpError(400, "مجموع التخصيصات يتجاوز قيمة الدفعة.");
      }

      for (let i = 0; i < parsed.length; i += 1) {
        const a = parsed[i];
        const amt = amounts[i];
        await this.assertInvoiceForCustomer(
          tx,
          factoryId,
          a.invoiceId,
          existing.customerId,
        );
        await this.repository.createAllocation(tx, paymentId, a.invoiceId, amt);
        if (existing.kind === "REFUND") {
          await this.reverseInvoicePayment(tx, a.invoiceId, amt);
        } else {
          await this.invoiceService.applyPayment(tx, a.invoiceId, amt);
        }
      }

      return this.requireById(tx, factoryId, paymentId);
    });
  }

  async removeAllocation(
    factoryId: string,
    actor: Actor,
    paymentId: string,
    allocationId: string,
  ): Promise<PaymentDetail> {
    this.assertManage(actor.role);
    return db.$transaction(async (tx) => {
      const existing = await this.repository.getRawById(
        tx,
        factoryId,
        paymentId,
      );
      if (!existing) throw new HttpError(404, "الدفعة غير موجودة.");

      const alloc = await this.repository.findAllocation(
        tx,
        paymentId,
        allocationId,
      );
      if (!alloc) throw new HttpError(404, "التخصيص غير موجود.");

      // Reverse the allocation's effect on the invoice.
      if (existing.kind === "REFUND") {
        await this.invoiceService.applyPayment(
          tx,
          alloc.invoiceId,
          alloc.amount,
        );
      } else {
        await this.reverseInvoicePayment(tx, alloc.invoiceId, alloc.amount);
      }
      await this.repository.deleteAllocation(tx, paymentId, allocationId);

      return this.requireById(tx, factoryId, paymentId);
    });
  }

  // ---------- Reporting ----------
  async getCustomerBalance(
    factoryId: string,
    role: UserRole,
    customerId: string,
  ): Promise<{
    totalInvoiced: string;
    totalPaid: string;
    outstanding: string;
  }> {
    this.assertView(role);
    const { totalInvoiced, totalPaid } =
      await this.repository.getCustomerBalance(factoryId, customerId);
    const ti = roundMoney(totalInvoiced);
    const tp = roundMoney(totalPaid);
    const outstanding = roundMoney(ti.minus(tp));
    return {
      totalInvoiced: decToString(ti),
      totalPaid: decToString(tp),
      outstanding: decToString(outstanding),
    };
  }

  // ---------- Internals ----------
  private async assertInvoiceForCustomer(
    tx: PrismaTransaction,
    factoryId: string,
    invoiceId: string,
    customerId: string,
  ): Promise<void> {
    const inv = await tx.invoice.findFirst({
      where: { id: invoiceId, factoryId, deletedAt: null },
      select: { id: true, customerId: true },
    });
    if (!inv) throw new HttpError(404, "الفاتورة غير موجودة.");
    if (inv.customerId !== customerId) {
      throw new HttpError(400, "لا يمكن تخصيص الدفعة لفاتورة عميل آخر.");
    }
  }

  /**
   * Reverses a previously applied payment on an invoice. Used for REFUND
   * allocations and when soft-deleting payments / removing allocations.
   *
   * Mirrors InvoiceService.applyPayment but in the opposite direction —
   * decrements amountPaid and demotes status (PAID/PARTIALLY_PAID -> SENT)
   * as appropriate. Will not go below zero.
   */
  private async reverseInvoicePayment(
    tx: PrismaTransaction,
    invoiceId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    if (amount.lte(0)) {
      throw new HttpError(400, "قيمة العكس يجب أن تكون أكبر من صفر.");
    }
    // Per-invoice advisory lock — symmetric with InvoiceService.applyPayment
    // to serialize all amountPaid mutations on the same invoice.
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `invoice_pay:${invoiceId}`,
    );
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        total: true,
        amountPaid: true,
        deletedAt: true,
      },
    });
    if (!invoice || invoice.deletedAt) {
      throw new HttpError(404, "الفاتورة غير موجودة.");
    }
    if (invoice.status === "VOID") {
      throw new HttpError(409, "لا يمكن عكس دفعة على فاتورة ملغاة.");
    }
    let newAmountPaid = roundMoney(invoice.amountPaid.minus(amount));
    if (newAmountPaid.lt(0)) newAmountPaid = new Prisma.Decimal(0);

    let nextStatus: typeof invoice.status = invoice.status;
    if (newAmountPaid.lte(0)) {
      // Demote PAID/PARTIALLY_PAID/OVERDUE back to SENT when fully reversed.
      if (
        invoice.status === "PAID" ||
        invoice.status === "PARTIALLY_PAID" ||
        invoice.status === "OVERDUE"
      ) {
        nextStatus = "SENT";
      }
    } else if (newAmountPaid.lt(invoice.total)) {
      if (invoice.status === "PAID") nextStatus = "PARTIALLY_PAID";
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: newAmountPaid, status: nextStatus },
    });
  }

  private async requireById(
    tx: PrismaTransaction,
    factoryId: string,
    paymentId: string,
  ): Promise<PaymentDetail> {
    const p = await this.repository.getDetailInTx(tx, factoryId, paymentId);
    if (!p) throw new HttpError(404, "الدفعة غير موجودة.");
    return p;
  }
}
