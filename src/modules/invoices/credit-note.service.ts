import "server-only";

import { Prisma, type UserRole } from "@prisma/client";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { computeTax, lineTotal, roundMoney, sumMoney } from "@/lib/money";
import { hasPermission } from "@/modules/auth/roles";

import {
  CreateCreditNoteInput,
  type CreateCreditNoteInputType,
  type CreditNoteDetail,
  type CreditNoteLineInputType,
  type CreditNoteListItem,
} from "./invoice.schemas";
import {
  CreditNoteRepository,
  type CreditNoteHeaderWritable,
  type CreditNoteLineWritable,
} from "./credit-note.repository";

type Actor = { userId: string; role: UserRole };

const DEFAULT_TAX_RATE = new Prisma.Decimal("15.00");
const ZERO = new Prisma.Decimal(0);

function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

export class CreditNoteService {
  constructor(private readonly repository = new CreditNoteRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "invoices:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض إشعارات الدائن.");
    }
  }
  private assertManage(role: UserRole) {
    if (!hasPermission(role, "credit-notes:manage")) {
      throw new HttpError(403, "ليس لديك صلاحية إدارة إشعارات الدائن.");
    }
  }

  async listByInvoice(
    factoryId: string,
    role: UserRole,
    invoiceId: string,
  ): Promise<CreditNoteListItem[]> {
    this.assertView(role);
    return this.repository.listByInvoice(factoryId, invoiceId);
  }

  async getById(
    factoryId: string,
    role: UserRole,
    creditNoteId: string,
  ): Promise<CreditNoteDetail> {
    this.assertView(role);
    const cn = await this.repository.getById(factoryId, creditNoteId);
    if (!cn) throw new HttpError(404, "إشعار الدائن غير موجود.");
    return cn;
  }

  async create(
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    input: unknown,
  ): Promise<CreditNoteDetail> {
    this.assertManage(actor.role);
    const parsed = CreateCreditNoteInput.parse(input) as CreateCreditNoteInputType;

    return db.$transaction(async (tx) => {
      const invoice = await this.repository.findInvoice(tx, factoryId, invoiceId);
      if (!invoice) throw new HttpError(404, "الفاتورة غير موجودة.");
      if (invoice.status === "DRAFT") {
        throw new HttpError(409, "لا يمكن إصدار إشعار دائن لفاتورة مسودة.");
      }
      if (invoice.status === "VOID") {
        throw new HttpError(409, "لا يمكن إصدار إشعار دائن لفاتورة ملغاة.");
      }

      const taxRate = parsed.taxRate !== undefined
        ? new Prisma.Decimal(parsed.taxRate)
        : DEFAULT_TAX_RATE;

      const writableLines = this.buildWritableLines(parsed.lines);
      const totals = this.computeTotals({ lines: writableLines, taxRate });

      const header: CreditNoteHeaderWritable = {
        invoiceId,
        reason: parsed.reason,
        taxRate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
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

  async issue(
    factoryId: string,
    actor: Actor,
    creditNoteId: string,
  ): Promise<CreditNoteDetail> {
    this.assertManage(actor.role);
    return db.$transaction(async (tx) => {
      const existing = await this.repository.getRawById(tx, factoryId, creditNoteId);
      if (!existing) throw new HttpError(404, "إشعار الدائن غير موجود.");
      if (existing.status !== "DRAFT") {
        throw new HttpError(409, "حالة غير صالحة للإصدار.");
      }
      if (existing.lines.length === 0) {
        throw new HttpError(409, "لا يمكن إصدار إشعار دائن بدون بنود.");
      }

      await this.repository.acquireNumberLock(tx, factoryId);
      const lastSeq = await this.repository.getLastNumberSeq(tx, factoryId);
      const numberSeq = Math.max(lastSeq, 0) + 1;
      const year = new Date().getFullYear();
      const number = `CN-${year}-${pad5(numberSeq)}`;

      return this.repository.assignNumberAndIssue(tx, creditNoteId, {
        number,
        numberSeq,
        issuedAt: new Date(),
      });
    });
  }

  async void(
    factoryId: string,
    actor: Actor,
    creditNoteId: string,
    _reason?: string,
  ): Promise<CreditNoteDetail> {
    this.assertManage(actor.role);
    return db.$transaction(async (tx) => {
      const existing = await this.repository.getRawById(tx, factoryId, creditNoteId);
      if (!existing) throw new HttpError(404, "إشعار الدائن غير موجود.");
      if (existing.status === "VOID") {
        throw new HttpError(409, "إشعار الدائن ملغي بالفعل.");
      }
      return this.repository.setStatus(tx, creditNoteId, "VOID", {
        voidedAt: new Date(),
      });
    });
  }

  // ---------- Helpers ----------
  private buildWritableLine(
    input: CreditNoteLineInputType,
    sortOrder: number,
  ): CreditNoteLineWritable {
    const quantity = new Prisma.Decimal(input.quantity);
    const unitPrice = new Prisma.Decimal(input.unitPrice);
    return {
      description: input.description,
      invoiceLineId: input.invoiceLineId ?? null,
      quantity,
      unitPrice,
      lineTotal: lineTotal(quantity, unitPrice),
      sortOrder,
    };
  }

  private buildWritableLines(
    inputs: CreditNoteLineInputType[],
  ): CreditNoteLineWritable[] {
    return inputs.map((line, index) =>
      this.buildWritableLine(line, line.sortOrder ?? index),
    );
  }

  private computeTotals(args: {
    lines: Array<{ lineTotal: Prisma.Decimal }>;
    taxRate: Prisma.Decimal;
  }): { subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; total: Prisma.Decimal } {
    const linesSum = sumMoney(args.lines.map((l) => l.lineTotal));
    let preTax = roundMoney(linesSum);
    if (preTax.lt(0)) preTax = ZERO;
    const breakdown = computeTax(preTax, args.taxRate, "exclusive");
    return {
      subtotal: breakdown.subtotal,
      taxAmount: breakdown.taxAmount,
      total: breakdown.total,
    };
  }

  private draftPlaceholder(): { number: string; seq: number } {
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    return { number: `DRAFT-${ts}-${rand}`, seq: 0 };
  }
}
