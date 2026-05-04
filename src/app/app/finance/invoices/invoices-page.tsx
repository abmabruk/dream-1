"use client";

/**
 * InvoicesPage — admin list of invoices with filters, KPI tiles, and a
 * sortable table. Click a row to open the detail page. "+ فاتورة جديدة"
 * creates a blank DRAFT and navigates straight to its editor.
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
  INVOICE_STATUS_LABELS_AR,
  INVOICE_STATUS_VALUES,
  type InvoiceListItem,
} from "@/modules/invoices/invoice.schemas";

interface CustomerOpt {
  id: string;
  name: string;
}

interface InvoicesPageProps {
  invoices: InvoiceListItem[];
  customers: CustomerOpt[];
  canManage: boolean;
  defaultStatus: string;
  defaultQuery: string;
  defaultCustomerId: string;
}

function sumDecimal(values: string[]): number {
  return values.reduce((acc, v) => acc + Number(v || 0), 0);
}

export function InvoicesPage({
  invoices,
  customers,
  canManage,
  defaultStatus,
  defaultQuery,
  defaultCustomerId,
}: InvoicesPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState(defaultStatus);
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [search, setSearch] = useState(defaultQuery);
  const [creating, setCreating] = useState(false);

  const customerName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.name ?? "—",
    [customers],
  );

  const totals = useMemo(() => {
    const totalInvoiced = sumDecimal(
      invoices.filter((i) => i.status !== "VOID").map((i) => i.total),
    );
    const totalPaid = sumDecimal(invoices.map((i) => i.amountPaid));
    const outstanding = sumDecimal(
      invoices
        .filter((i) => i.status !== "VOID" && i.status !== "PAID")
        .map((i) => i.amountDue),
    );
    const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
    return { totalInvoiced, totalPaid, outstanding, overdueCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.number.toLowerCase().includes(q) ||
        customerName(i.customerId).toLowerCase().includes(q),
    );
  }, [invoices, search, customerName]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (customerId) params.set("customerId", customerId);
    if (search.trim()) params.set("q", search.trim());
    router.push(`/app/finance/invoices?${params.toString()}`);
  }, [status, customerId, search, router]);

  const handleCreate = useCallback(async () => {
    if (!customerId) {
      toast("اختر العميل أولاً قبل إنشاء فاتورة جديدة", "error");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch(`/api/v1/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, lines: [] }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر إنشاء الفاتورة", "error");
        return;
      }
      const newId = (json.data as { id: string }).id;
      toast("تم إنشاء فاتورة جديدة", "success");
      router.push(`/app/finance/invoices/${newId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setCreating(false);
    }
  }, [customerId, toast, router]);

  return (
    <main className="space-y-6">
      <PageHeader
        caption="الماليات"
        title={`الفواتير (${invoices.length})`}
        description="قائمة الفواتير مع المرشحات والمؤشرات الأساسية."
        actions={
          canManage ? (
            <button
              type="button"
              className="button-primary text-sm"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "جاري الإنشاء…" : "+ فاتورة جديدة"}
            </button>
          ) : null
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="إجمالي المُفوتر"
          value={formatSAR(totals.totalInvoiced)}
        />
        <MetricCard
          label="إجمالي المدفوع"
          value={formatSAR(totals.totalPaid)}
          tone="accent"
        />
        <MetricCard
          label="المستحقات المتبقية"
          value={formatSAR(totals.outstanding)}
          tone={totals.outstanding > 0 ? "warn" : "muted"}
        />
        <MetricCard
          label="فواتير متأخرة"
          value={totals.overdueCount}
          tone={totals.overdueCount > 0 ? "danger" : "muted"}
        />
      </section>

      <section className="panel">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block text-sm">
            بحث
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="رقم الفاتورة أو اسم العميل"
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="block text-sm">
            الحالة
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">الكل</option>
              {INVOICE_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUS_LABELS_AR[s]}
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
          <div className="flex items-end">
            <button
              type="button"
              className="button-primary w-full text-sm"
              onClick={applyFilters}
            >
              تطبيق المرشحات
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        {filtered.length === 0 ? (
          <EmptyState
            heading="لا توجد فواتير"
            description="جرّب تعديل المرشحات أو أنشئ فاتورة جديدة."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <th className="py-2 text-start">الرقم</th>
                  <th className="py-2 text-start">العميل</th>
                  <th className="py-2 text-start">تاريخ الإصدار</th>
                  <th className="py-2 text-start">تاريخ الاستحقاق</th>
                  <th className="py-2 text-end">الإجمالي</th>
                  <th className="py-2 text-end">المدفوع</th>
                  <th className="py-2 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() =>
                      router.push(`/app/finance/invoices/${inv.id}`)
                    }
                    className="cursor-pointer border-t hover:bg-[var(--panel-strong)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="py-2.5 font-medium">{inv.number}</td>
                    <td className="py-2.5">{customerName(inv.customerId)}</td>
                    <td className="py-2.5 text-[var(--muted-foreground)]">
                      {formatDateAr(inv.issueDate)}
                    </td>
                    <td className="py-2.5 text-[var(--muted-foreground)]">
                      {inv.dueDate ? formatDateAr(inv.dueDate) : "—"}
                    </td>
                    <td className="py-2.5 text-end tabular-nums">
                      {formatSAR(inv.total)}
                    </td>
                    <td className="py-2.5 text-end tabular-nums">
                      {formatSAR(inv.amountPaid)}
                    </td>
                    <td className="py-2.5">
                      <StatusPill
                        status={inv.status}
                        label={INVOICE_STATUS_LABELS_AR[inv.status]}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default InvoicesPage;
