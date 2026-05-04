"use client";

/**
 * InvoiceDetailView — full client editor for a single invoice. Mirrors
 * the QuoteForm shape from Phase 2 but with invoice-specific state
 * transitions:
 *
 *   - DRAFT     → save / send / delete                (canManage / canIssue)
 *   - SENT/PARTIAL/OVERDUE → void / credit-note       (canVoid / canCreditNote)
 *   - PAID      → void (admin) / credit-note          (canVoid / canCreditNote)
 *   - VOID      → read-only
 *
 * Lines are editable inline only while DRAFT — once SENT they become a
 * read-only snapshot. Pricing summary on the right is always derived
 * from server payload (no client recompute).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { StatusPill, useToast } from "@/components/ui";
import { formatDateAr, formatSAR } from "@/lib/format";
import {
  CREDIT_NOTE_STATUS_LABELS_AR,
  INVOICE_STATUS_LABELS_AR,
  type CreditNoteListItem,
  type InvoiceDetail,
  type InvoiceLineDetail,
} from "@/modules/invoices/invoice.schemas";

import { RecordPaymentForm } from "../../payments/record-payment-form";

import { CreditNoteForm } from "../credit-note-form";

interface CustomerInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
}

interface InvoiceDetailViewProps {
  invoice: InvoiceDetail;
  creditNotes: CreditNoteListItem[];
  customer: CustomerInfo | null;
  canManage: boolean;
  canIssue: boolean;
  canVoid: boolean;
  canCreditNote: boolean;
  canRecordPayment?: boolean;
}

type LineDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
};

const EMPTY_LINE: LineDraft = {
  description: "",
  quantity: "1",
  unitPrice: "0",
};

export function InvoiceDetailView({
  invoice: initialInvoice,
  creditNotes: initialCreditNotes,
  customer,
  canManage,
  canIssue,
  canVoid,
  canCreditNote,
  canRecordPayment = false,
}: InvoiceDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<InvoiceDetail>(initialInvoice);
  const [creditNotes, setCreditNotes] =
    useState<CreditNoteListItem[]>(initialCreditNotes);
  const [busy, setBusy] = useState<string | null>(null);
  const [newLine, setNewLine] = useState<LineDraft>(EMPTY_LINE);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const isDraft = invoice.status === "DRAFT";
  const isOpen =
    invoice.status === "SENT" ||
    invoice.status === "PARTIALLY_PAID" ||
    invoice.status === "OVERDUE";
  const isPaid = invoice.status === "PAID";

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/invoices/${invoice.id}`, {
        cache: "no-store",
      });
      const json = await r.json();
      if (r.ok && json.ok) setInvoice(json.data as InvoiceDetail);
      const r2 = await fetch(
        `/api/v1/invoices/${invoice.id}/credit-notes`,
        { cache: "no-store" },
      );
      const j2 = await r2.json();
      if (r2.ok && j2.ok) setCreditNotes(j2.data as CreditNoteListItem[]);
    } catch {
      // silent
    }
  }, [invoice.id]);

  useEffect(() => {
    setInvoice(initialInvoice);
  }, [initialInvoice]);

  // ── Mutations ────────────────────────────────────────────────────

  const patchInvoice = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy("save");
      try {
        const r = await fetch(`/api/v1/invoices/${invoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر الحفظ", "error");
          return;
        }
        setInvoice(json.data as InvoiceDetail);
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [invoice.id, toast],
  );

  const action = useCallback(
    async (
      path: string,
      label: string,
      key: string,
      body?: Record<string, unknown>,
    ) => {
      setBusy(key);
      try {
        const r = await fetch(`/api/v1/invoices/${invoice.id}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? `تعذّر ${label}`, "error");
          return;
        }
        toast(`تم ${label}`, "success");
        await reload();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [invoice.id, toast, reload],
  );

  const handleDelete = useCallback(async () => {
    if (!confirm("هل تريد حذف هذه المسودة؟")) return;
    setBusy("delete");
    try {
      const r = await fetch(`/api/v1/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر الحذف", "error");
        return;
      }
      toast("تم حذف المسودة", "success");
      router.push("/app/finance/invoices");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setBusy(null);
    }
  }, [invoice.id, toast, router]);

  const handleVoid = useCallback(async () => {
    const reason = prompt("سبب الإلغاء:");
    if (!reason || !reason.trim()) return;
    await action("void", "الإلغاء", "void", { reason: reason.trim() });
  }, [action]);

  const handleAddLine = useCallback(async () => {
    if (!newLine.description.trim()) {
      toast("الوصف مطلوب", "error");
      return;
    }
    setBusy("addLine");
    try {
      const r = await fetch(`/api/v1/invoices/${invoice.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newLine.description,
          quantity: newLine.quantity,
          unitPrice: newLine.unitPrice,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر إضافة البند", "error");
        return;
      }
      setNewLine(EMPTY_LINE);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setBusy(null);
    }
  }, [invoice.id, newLine, toast, reload]);

  const handleUpdateLine = useCallback(
    async (lineId: string, patch: Partial<InvoiceLineDetail>) => {
      setBusy(`line-${lineId}`);
      try {
        const r = await fetch(
          `/api/v1/invoices/${invoice.id}/lines/${lineId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر تحديث البند", "error");
          return;
        }
        await reload();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [invoice.id, toast, reload],
  );

  const handleDeleteLine = useCallback(
    async (lineId: string) => {
      if (!confirm("حذف هذا البند؟")) return;
      setBusy(`line-${lineId}`);
      try {
        const r = await fetch(
          `/api/v1/invoices/${invoice.id}/lines/${lineId}`,
          { method: "DELETE" },
        );
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر الحذف", "error");
          return;
        }
        await reload();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [invoice.id, toast, reload],
  );

  // ── Customer display: prefer snapshot once SENT ──────────────────

  const showSnapshot = !isDraft;
  const buyerName = showSnapshot
    ? invoice.buyerNameSnapshot ?? customer?.name ?? "—"
    : customer?.name ?? "—";

  const dueDateValue = invoice.dueDate ? invoice.dueDate.slice(0, 10) : "";

  // ── Render ───────────────────────────────────────────────────────

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              فاتورة
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{invoice.number}</h1>
              <StatusPill
                status={invoice.status}
                label={INVOICE_STATUS_LABELS_AR[invoice.status]}
              />
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {buyerName} · أُصدرت في {formatDateAr(invoice.issueDate)}
              {invoice.dueDate
                ? ` · مستحقة في ${formatDateAr(invoice.dueDate)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDraft && canIssue ? (
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => action("send", "الإرسال", "send")}
                disabled={busy !== null}
              >
                {busy === "send" ? "جاري الإرسال…" : "إرسال"}
              </button>
            ) : null}
            {isDraft && canManage ? (
              <button
                type="button"
                className="button-danger text-sm"
                onClick={handleDelete}
                disabled={busy !== null}
              >
                {busy === "delete" ? "جاري الحذف…" : "حذف"}
              </button>
            ) : null}
            {(isOpen || isPaid) && canVoid ? (
              <button
                type="button"
                className="button-danger text-sm"
                onClick={handleVoid}
                disabled={busy !== null}
              >
                {busy === "void" ? "جاري الإلغاء…" : "إلغاء"}
              </button>
            ) : null}
            {isOpen && canRecordPayment ? (
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => setShowPaymentForm(true)}
                disabled={busy !== null}
              >
                تسجيل دفعة
              </button>
            ) : null}
            {(isOpen || isPaid) && canCreditNote ? (
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => setShowCreditForm(true)}
                disabled={busy !== null}
              >
                إنشاء إشعار دائن
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Left: lines + customer */}
        <div className="space-y-6">
          {/* Lines */}
          <section className="panel">
            <h2 className="text-lg font-semibold">البنود</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    <th className="py-2 text-start">#</th>
                    <th className="py-2 text-start">الوصف</th>
                    <th className="py-2 text-end">الكمية</th>
                    <th className="py-2 text-end">سعر الوحدة</th>
                    <th className="py-2 text-end">الإجمالي</th>
                    {isDraft && canManage ? (
                      <th className="py-2 text-end">إجراءات</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isDraft && canManage ? 6 : 5}
                        className="py-6 text-center text-sm text-[var(--muted-foreground)]"
                      >
                        لا توجد بنود بعد.
                      </td>
                    </tr>
                  ) : (
                    invoice.lines.map((line) => (
                      <tr
                        key={line.id}
                        className="border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="py-2.5 tabular-nums text-[var(--muted-foreground)]">
                          {line.sortOrder + 1}
                        </td>
                        <td className="py-2.5">
                          {isDraft && canManage ? (
                            <input
                              type="text"
                              defaultValue={line.description}
                              className="input w-full"
                              onBlur={(e) => {
                                if (e.target.value !== line.description) {
                                  void handleUpdateLine(line.id, {
                                    description: e.target.value,
                                  });
                                }
                              }}
                              disabled={busy !== null}
                            />
                          ) : (
                            line.description
                          )}
                        </td>
                        <td className="py-2.5 text-end tabular-nums">
                          {isDraft && canManage ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={String(line.quantity)}
                              className="input w-24 text-end"
                              onBlur={(e) => {
                                if (e.target.value !== String(line.quantity)) {
                                  void handleUpdateLine(line.id, {
                                    quantity: e.target.value as unknown as string,
                                  });
                                }
                              }}
                              disabled={busy !== null}
                            />
                          ) : (
                            String(line.quantity)
                          )}
                        </td>
                        <td className="py-2.5 text-end tabular-nums">
                          {isDraft && canManage ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={String(line.unitPrice)}
                              className="input w-28 text-end"
                              onBlur={(e) => {
                                if (e.target.value !== String(line.unitPrice)) {
                                  void handleUpdateLine(line.id, {
                                    unitPrice: e.target.value as unknown as string,
                                  });
                                }
                              }}
                              disabled={busy !== null}
                            />
                          ) : (
                            formatSAR(line.unitPrice)
                          )}
                        </td>
                        <td className="py-2.5 text-end font-semibold tabular-nums">
                          {formatSAR(line.lineTotal)}
                        </td>
                        {isDraft && canManage ? (
                          <td className="py-2.5 text-end">
                            <button
                              type="button"
                              className="button-danger text-xs"
                              style={{
                                height: "2rem",
                                paddingInline: "0.75rem",
                              }}
                              onClick={() => handleDeleteLine(line.id)}
                              disabled={busy !== null}
                            >
                              حذف
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {isDraft && canManage ? (
              <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel-strong)] p-3 sm:grid-cols-[1fr_6rem_8rem_auto]">
                <input
                  type="text"
                  placeholder="وصف البند"
                  className="input"
                  value={newLine.description}
                  onChange={(e) =>
                    setNewLine((p) => ({ ...p, description: e.target.value }))
                  }
                  disabled={busy !== null}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="الكمية"
                  className="input text-end"
                  value={newLine.quantity}
                  onChange={(e) =>
                    setNewLine((p) => ({ ...p, quantity: e.target.value }))
                  }
                  disabled={busy !== null}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="سعر الوحدة"
                  className="input text-end"
                  value={newLine.unitPrice}
                  onChange={(e) =>
                    setNewLine((p) => ({ ...p, unitPrice: e.target.value }))
                  }
                  disabled={busy !== null}
                />
                <button
                  type="button"
                  className="button-secondary text-sm"
                  onClick={handleAddLine}
                  disabled={busy !== null}
                >
                  {busy === "addLine" ? "جاري الإضافة…" : "+ إضافة بند"}
                </button>
              </div>
            ) : null}
          </section>

          {/* Customer */}
          <section className="panel">
            <h2 className="text-lg font-semibold">بيانات العميل</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {showSnapshot
                ? "لقطة محفوظة وقت الإصدار"
                : "البيانات الحية للعميل"}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted-foreground)]">الاسم</dt>
                <dd className="mt-0.5 font-medium">{buyerName}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted-foreground)]">
                  الرقم الضريبي
                </dt>
                <dd className="mt-0.5 font-medium">
                  {invoice.buyerTaxNumberSnapshot ?? "—"}
                </dd>
              </div>
              {!showSnapshot && customer ? (
                <>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      البريد الإلكتروني
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {customer.email ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">الجوال</dt>
                    <dd className="mt-0.5 font-medium">
                      {customer.phone ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">المدينة</dt>
                    <dd className="mt-0.5 font-medium">
                      {customer.city ?? "—"}
                    </dd>
                  </div>
                </>
              ) : null}
              {showSnapshot && invoice.buyerAddressSnapshot ? (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted-foreground)]">العنوان</dt>
                  <dd className="mt-0.5 whitespace-pre-line font-medium">
                    {invoice.buyerAddressSnapshot}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Credit notes */}
          {creditNotes.length > 0 ? (
            <section className="panel">
              <h2 className="text-lg font-semibold">الإشعارات الدائنة</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      <th className="py-2 text-start">الرقم</th>
                      <th className="py-2 text-start">الحالة</th>
                      <th className="py-2 text-start">السبب</th>
                      <th className="py-2 text-end">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditNotes.map((cn) => (
                      <tr
                        key={cn.id}
                        className="border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="py-2.5 font-medium">
                          {cn.number || "—"}
                        </td>
                        <td className="py-2.5">
                          <StatusPill
                            status={cn.status}
                            label={CREDIT_NOTE_STATUS_LABELS_AR[cn.status]}
                            size="sm"
                          />
                        </td>
                        <td className="py-2.5 text-[var(--muted-foreground)]">
                          {cn.reason}
                        </td>
                        <td className="py-2.5 text-end tabular-nums">
                          {formatSAR(cn.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        {/* Right: pricing + meta */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <h3 className="text-sm font-semibold">ملخّص التسعير</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">المجموع الفرعي</dt>
                <dd className="font-semibold tabular-nums">
                  {formatSAR(invoice.subtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">الخصم</dt>
                <dd>
                  {isDraft && canManage ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-28 text-end"
                      defaultValue={String(invoice.discountAmount ?? "0")}
                      onBlur={(e) => {
                        if (
                          e.target.value !==
                          String(invoice.discountAmount ?? "0")
                        ) {
                          void patchInvoice({ discountAmount: e.target.value });
                        }
                      }}
                      disabled={busy !== null}
                    />
                  ) : (
                    <span className="font-semibold tabular-nums">
                      {formatSAR(invoice.discountAmount)}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">
                  نسبة الضريبة %
                </dt>
                <dd className="font-semibold tabular-nums">
                  {String(invoice.taxRate)}%
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">مبلغ الضريبة</dt>
                <dd className="font-semibold tabular-nums">
                  {formatSAR(invoice.taxAmount)}
                </dd>
              </div>
              <div
                className="mt-2 flex items-center justify-between border-t pt-3"
                style={{ borderColor: "var(--border)" }}
              >
                <dt className="text-base font-semibold">الإجمالي</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatSAR(invoice.total)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">المدفوع</dt>
                <dd className="font-semibold tabular-nums">
                  {formatSAR(invoice.amountPaid)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">المتبقي</dt>
                <dd
                  className="text-lg font-semibold tabular-nums"
                  style={{
                    color:
                      Number(invoice.amountDue) > 0
                        ? "var(--tone-blocked-fg)"
                        : "var(--foreground)",
                  }}
                >
                  {formatSAR(invoice.amountDue)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <label className="text-sm font-semibold">تاريخ الاستحقاق</label>
            <input
              type="date"
              className="input mt-2 w-full"
              defaultValue={dueDateValue}
              onBlur={(e) => {
                if (e.target.value !== dueDateValue) {
                  void patchInvoice({ dueDate: e.target.value || null });
                }
              }}
              disabled={!isDraft || !canManage || busy !== null}
            />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <label className="text-sm font-semibold">ملاحظات</label>
            <textarea
              className="input mt-2 w-full"
              rows={3}
              defaultValue={invoice.notes ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (invoice.notes ?? "")) {
                  void patchInvoice({ notes: e.target.value });
                }
              }}
              disabled={!isDraft || !canManage || busy !== null}
            />
          </div>

          {invoice.voidedReason ? (
            <div
              className="rounded-2xl border p-4 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--tone-blocked-bg, #fee)",
              }}
            >
              <p className="font-semibold">سبب الإلغاء</p>
              <p className="mt-1 text-[var(--muted-foreground)]">
                {invoice.voidedReason}
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <CreditNoteForm
        open={showCreditForm}
        invoiceId={invoice.id}
        invoiceLines={invoice.lines}
        onClose={() => setShowCreditForm(false)}
        onCreated={reload}
      />

      {customer ? (
        <RecordPaymentForm
          open={showPaymentForm}
          onClose={() => setShowPaymentForm(false)}
          onCreated={reload}
          customers={[{ id: customer.id, name: customer.name }]}
          openInvoices={[
            {
              id: invoice.id,
              number: invoice.number,
              customerId: invoice.customerId,
              total: invoice.total,
              amountPaid: invoice.amountPaid,
              amountDue: invoice.amountDue,
            },
          ]}
          initialCustomerId={customer.id}
          initialAmount={invoice.amountDue}
          initialAllocationInvoiceId={invoice.id}
          lockCustomer
        />
      ) : null}
    </main>
  );
}

export default InvoiceDetailView;
