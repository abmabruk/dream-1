"use client";

/**
 * RecordPaymentForm — modal form for recording a customer payment with
 * optional invoice allocations. Used both from the Payments admin page
 * and from the invoice detail "تسجيل دفعة" action.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { BottomSheet, useToast } from "@/components/ui";
import { formatSAR } from "@/lib/format";
import {
  PAYMENT_KIND_LABELS_AR,
  PAYMENT_KIND_VALUES,
  PAYMENT_METHOD_LABELS_AR,
  PAYMENT_METHOD_VALUES,
  type PaymentKind,
  type PaymentMethod,
} from "@/modules/payments/payment.schemas";

export interface CustomerOpt {
  id: string;
  name: string;
}

export interface OpenInvoiceOpt {
  id: string;
  number: string;
  customerId: string;
  total: string;
  amountPaid: string;
  amountDue: string;
}

export interface RecordPaymentFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  customers: CustomerOpt[];
  openInvoices: OpenInvoiceOpt[];
  /** Pre-fill customer (e.g. when launched from invoice detail) */
  initialCustomerId?: string;
  /** Pre-fill amount (e.g. invoice.amountDue) */
  initialAmount?: string;
  /** Pre-fill allocation against this invoice with the given amount */
  initialAllocationInvoiceId?: string;
  /** Lock customer selector (when launched from invoice detail) */
  lockCustomer?: boolean;
}

type AllocDraft = Record<string, string>; // invoiceId -> amount string

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentForm({
  open,
  onClose,
  onCreated,
  customers,
  openInvoices,
  initialCustomerId,
  initialAmount,
  initialAllocationInvoiceId,
  lockCustomer,
}: RecordPaymentFormProps) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [kind, setKind] = useState<PaymentKind>("PAYMENT");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [notes, setNotes] = useState("");
  const [allocs, setAllocs] = useState<AllocDraft>(
    initialAllocationInvoiceId && initialAmount
      ? { [initialAllocationInvoiceId]: initialAmount }
      : {},
  );
  const [busy, setBusy] = useState(false);

  // Sync when reopened with new initial values
  useEffect(() => {
    if (!open) return;
    setCustomerId(initialCustomerId ?? "");
    setAmount(initialAmount ?? "");
    setAllocs(
      initialAllocationInvoiceId && initialAmount
        ? { [initialAllocationInvoiceId]: initialAmount }
        : {},
    );
    setKind("PAYMENT");
    setMethod("BANK_TRANSFER");
    setReference("");
    setReceivedAt(todayIso());
    setNotes("");
    setCustomerSearch("");
  }, [open, initialCustomerId, initialAmount, initialAllocationInvoiceId]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const customerInvoices = useMemo(
    () => openInvoices.filter((i) => i.customerId === customerId),
    [openInvoices, customerId],
  );

  const allocSum = useMemo(
    () =>
      Object.values(allocs).reduce(
        (acc, v) => acc + Number(v || 0),
        0,
      ),
    [allocs],
  );

  const amountNum = Number(amount || 0);
  const diff = amountNum - allocSum;

  const updateAlloc = useCallback((invoiceId: string, value: string) => {
    setAllocs((prev) => {
      const next = { ...prev };
      if (!value || Number(value) === 0) {
        delete next[invoiceId];
      } else {
        next[invoiceId] = value;
      }
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (!customerId) {
      toast("اختر العميل", "error");
      return;
    }
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) {
      toast("أدخل قيمة الدفعة", "error");
      return;
    }
    if (allocSum > amt + 0.001) {
      toast("مجموع التوزيعات يتجاوز قيمة الدفعة", "error");
      return;
    }
    setBusy(true);
    try {
      const allocations = Object.entries(allocs)
        .filter(([, v]) => Number(v) > 0)
        .map(([invoiceId, v]) => ({ invoiceId, amount: v }));

      const r = await fetch(`/api/v1/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          kind,
          method,
          reference: reference.trim() || null,
          receivedAt,
          amount,
          notes: notes.trim() || null,
          allocations,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر تسجيل الدفعة", "error");
        return;
      }
      toast("تم تسجيل الدفعة", "success");
      await onCreated();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setBusy(false);
    }
  }, [
    customerId,
    amount,
    allocSum,
    allocs,
    kind,
    method,
    reference,
    receivedAt,
    notes,
    toast,
    onCreated,
    onClose,
  ]);

  return (
    <BottomSheet open={open} onClose={onClose} title="تسجيل دفعة">
      <div className="space-y-4">
        {/* Customer */}
        <div>
          <label className="text-sm font-semibold">العميل</label>
          {lockCustomer ? (
            <div className="input mt-2 flex items-center bg-[var(--panel-strong)]">
              {customers.find((c) => c.id === customerId)?.name ?? "—"}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="input mt-2 w-full"
                placeholder="ابحث عن عميل…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              <select
                className="input mt-2 w-full"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">اختر العميل…</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Kind + Method */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold">النوع</label>
            <select
              className="input mt-2 w-full"
              value={kind}
              onChange={(e) => setKind(e.target.value as PaymentKind)}
            >
              {PAYMENT_KIND_VALUES.map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_KIND_LABELS_AR[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">طريقة الدفع</label>
            <select
              className="input mt-2 w-full"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHOD_VALUES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS_AR[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reference + receivedAt */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold">المرجع</label>
            <input
              type="text"
              className="input mt-2 w-full"
              placeholder="رقم الحوالة / الشيك…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold">تاريخ الاستلام</label>
            <input
              type="date"
              className="input mt-2 w-full"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm font-semibold">المبلغ</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input mt-2 w-full text-end"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Allocations subform */}
        {customerId ? (
          <div>
            <h4 className="text-sm font-semibold">
              توزيع على فواتير العميل (اختياري)
            </h4>
            {customerInvoices.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                لا توجد فواتير مفتوحة لهذا العميل.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {customerInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="grid items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 sm:grid-cols-[1fr_auto_8rem]"
                  >
                    <div>
                      <div className="font-medium">{inv.number}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        المتبقي: {formatSAR(inv.amountDue)} · الإجمالي:{" "}
                        {formatSAR(inv.total)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button-secondary text-xs"
                      onClick={() => updateAlloc(inv.id, inv.amountDue)}
                    >
                      تعبئة المتبقي
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-end"
                      placeholder="0.00"
                      value={allocs[inv.id] ?? ""}
                      onChange={(e) => updateAlloc(inv.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Allocation summary */}
            {amountNum > 0 ? (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted-foreground)]">
                    مجموع التوزيعات
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatSAR(allocSum)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[var(--muted-foreground)]">
                    {diff > 0
                      ? "غير مخصّص"
                      : diff < 0
                        ? "تجاوز"
                        : "متطابق"}
                  </span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{
                      color:
                        diff < 0
                          ? "var(--tone-blocked-fg)"
                          : diff > 0
                            ? "var(--tone-warn-fg, var(--foreground))"
                            : "var(--foreground)",
                    }}
                  >
                    {formatSAR(Math.abs(diff))}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Notes */}
        <div>
          <label className="text-sm font-semibold">ملاحظات</label>
          <textarea
            className="input mt-2 w-full"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="button-secondary text-sm"
            onClick={onClose}
            disabled={busy}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="button-primary text-sm"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "جاري الحفظ…" : "تسجيل الدفعة"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default RecordPaymentForm;
