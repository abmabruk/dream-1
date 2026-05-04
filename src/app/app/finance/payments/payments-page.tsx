"use client";

/**
 * PaymentsPage — admin list of customer payments with filters, KPI tiles
 * and a table. Click "+ تسجيل دفعة" to open the RecordPaymentForm.
 */

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  EmptyState,
  MetricCard,
  PageHeader,
  StatusPill,
  useToast,
} from "@/components/ui";
import { formatDateAr, formatSAR } from "@/lib/format";
import {
  PAYMENT_KIND_LABELS_AR,
  PAYMENT_KIND_VALUES,
  PAYMENT_METHOD_LABELS_AR,
  type PaymentListItem,
} from "@/modules/payments/payment.schemas";

import {
  RecordPaymentForm,
  type CustomerOpt,
  type OpenInvoiceOpt,
} from "./record-payment-form";

interface PaymentsPageProps {
  payments: PaymentListItem[];
  customers: CustomerOpt[];
  openInvoices: OpenInvoiceOpt[];
  canManage: boolean;
  defaultKind: string;
  defaultFrom: string;
  defaultTo: string;
  defaultCustomerId: string;
  defaultQuery: string;
}

function sumDecimal(values: string[]): number {
  return values.reduce((acc, v) => acc + Number(v || 0), 0);
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth()
  );
}

export function PaymentsPage({
  payments,
  customers,
  openInvoices,
  canManage,
  defaultKind,
  defaultFrom,
  defaultTo,
  defaultCustomerId,
  defaultQuery,
}: PaymentsPageProps) {
  const router = useRouter();
  const { toast: _toast } = useToast();

  const [kind, setKind] = useState(defaultKind);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [search, setSearch] = useState(defaultQuery);
  const [showForm, setShowForm] = useState(false);

  const customerName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.name ?? "—",
    [customers],
  );

  const totals = useMemo(() => {
    const monthPayments = payments.filter(
      (p) => p.kind === "PAYMENT" && isThisMonth(p.receivedAt),
    );
    const monthRefunds = payments.filter(
      (p) => p.kind === "REFUND" && isThisMonth(p.receivedAt),
    );
    return {
      monthReceived: sumDecimal(monthPayments.map((p) => p.amount)),
      monthRefunds: sumDecimal(monthRefunds.map((p) => p.amount)),
      count: payments.length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        (p.customerName ?? customerName(p.customerId))
          .toLowerCase()
          .includes(q) ||
        (p.reference ?? "").toLowerCase().includes(q),
    );
  }, [payments, search, customerName]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (customerId) params.set("customerId", customerId);
    if (search.trim()) params.set("q", search.trim());
    router.push(`/app/finance/payments?${params.toString()}`);
  }, [kind, from, to, customerId, search, router]);

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <main className="space-y-6">
      <PageHeader
        caption="الماليات"
        title={`المدفوعات (${payments.length})`}
        description="سجل الدفعات الواردة من العملاء وتوزيعها على الفواتير."
        actions={
          canManage ? (
            <button
              type="button"
              className="button-primary text-sm"
              onClick={() => setShowForm(true)}
            >
              + تسجيل دفعة
            </button>
          ) : null
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="مدفوعات هذا الشهر"
          value={formatSAR(totals.monthReceived)}
          tone="accent"
        />
        <MetricCard
          label="استردادات هذا الشهر"
          value={formatSAR(totals.monthRefunds)}
          tone={totals.monthRefunds > 0 ? "warn" : "muted"}
        />
        <MetricCard label="عدد الدفعات" value={totals.count} />
      </section>

      <section className="panel">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="block text-sm">
            بحث
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم العميل أو المرجع"
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="block text-sm">
            النوع
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">الكل</option>
              {PAYMENT_KIND_VALUES.map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_KIND_LABELS_AR[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            العميل
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">الكل</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            من
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="block text-sm">
            إلى
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="button-primary text-sm"
            onClick={applyFilters}
          >
            تطبيق المرشحات
          </button>
        </div>
      </section>

      <section className="panel">
        {filtered.length === 0 ? (
          <EmptyState
            heading="لا توجد دفعات"
            description="جرّب تعديل المرشحات أو سجّل دفعة جديدة."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <th className="py-2 text-start">تاريخ الاستلام</th>
                  <th className="py-2 text-start">العميل</th>
                  <th className="py-2 text-start">النوع</th>
                  <th className="py-2 text-start">طريقة الدفع</th>
                  <th className="py-2 text-end">المبلغ</th>
                  <th className="py-2 text-end">التوزيعات</th>
                  <th className="py-2 text-start">ملاحظات</th>
                  <th className="py-2 text-start">سُجّلت بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t hover:bg-[var(--panel-strong)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="py-2.5 text-[var(--muted-foreground)]">
                      {formatDateAr(p.receivedAt)}
                    </td>
                    <td className="py-2.5 font-medium">
                      {p.customerName ?? customerName(p.customerId)}
                    </td>
                    <td className="py-2.5">
                      <StatusPill
                        status={p.kind}
                        label={PAYMENT_KIND_LABELS_AR[p.kind]}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5 text-[var(--muted-foreground)]">
                      {PAYMENT_METHOD_LABELS_AR[p.method]}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="py-2.5 text-end font-semibold tabular-nums">
                      {formatSAR(p.amount)}
                    </td>
                    <td className="py-2.5 text-end tabular-nums">
                      {formatSAR(p.allocatedAmount)}
                      {Number(p.unallocatedAmount) > 0 ? (
                        <span className="ms-1 text-xs text-[var(--muted-foreground)]">
                          (متبقي {formatSAR(p.unallocatedAmount)})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 max-w-[260px] truncate text-[var(--muted-foreground)]">
                      {p.notes ?? "—"}
                    </td>
                    <td className="py-2.5 text-[var(--muted-foreground)]">
                      {p.recordedByName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RecordPaymentForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={handleCreated}
        customers={customers}
        openInvoices={openInvoices}
        initialCustomerId={customerId || undefined}
      />
    </main>
  );
}

export default PaymentsPage;
