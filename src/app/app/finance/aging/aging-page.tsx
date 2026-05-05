"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, MetricCard, PageHeader } from "@/components/ui";
import { formatSAR, formatNumber } from "@/lib/format";
import type {
  AgingBucketKey,
  FactoryAgingReport,
} from "@/modules/invoices/aging.service";

interface AgingPageProps {
  report: FactoryAgingReport;
}

const BUCKET_LABELS_AR: Record<AgingBucketKey, string> = {
  "0-30": "٠–٣٠ يوم",
  "31-60": "٣١–٦٠ يوم",
  "61-90": "٦١–٩٠ يوم",
  "90+": "أكثر من ٩٠ يوم",
};

const BUCKET_TONE: Record<
  AgingBucketKey,
  "muted" | "warn" | "danger" | "accent"
> = {
  "0-30": "accent",
  "31-60": "warn",
  "61-90": "warn",
  "90+": "danger",
};

export function AgingPage({ report }: AgingPageProps) {
  const [search, setSearch] = useState("");

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return report.byCustomer;
    return report.byCustomer.filter((c) =>
      c.customerName.toLowerCase().includes(q),
    );
  }, [report.byCustomer, search]);

  return (
    <main className="space-y-6">
      <PageHeader
        caption="الماليات"
        title="تقرير أعمار الذمم المدينة"
        description={`نظرة فاحصة على المستحقات حسب الأعمار، تحديثاً اعتباراً من ${new Date(report.asOf).toLocaleString("ar-SA")}.`}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(BUCKET_LABELS_AR) as AgingBucketKey[]).map((bucket) => (
          <MetricCard
            key={bucket}
            label={BUCKET_LABELS_AR[bucket]}
            value={formatSAR(report.buckets[bucket])}
            tone={BUCKET_TONE[bucket]}
          />
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="إجمالي المستحقات"
          value={formatSAR(report.totals.totalOutstanding)}
          tone={Number(report.totals.totalOutstanding) > 0 ? "warn" : "muted"}
        />
        <MetricCard
          label="عدد الفواتير المفتوحة"
          value={formatNumber(report.totals.invoiceCount)}
        />
        <MetricCard
          label="عدد العملاء المدينين"
          value={formatNumber(report.totals.customerCount)}
        />
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">المستحقات حسب العميل</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم العميل"
            className="rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              heading="لا توجد مستحقات"
              description="جميع العملاء مسددون لمستحقاتهم الحالية."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 hidden md:block overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    <th className="py-2 text-start">العميل</th>
                    <th className="py-2 text-end">المستحق</th>
                    <th className="py-2 text-end">عدد الفواتير</th>
                    <th className="py-2 text-end">أقدم فاتورة (يوم)</th>
                    <th className="py-2 text-start">الفئة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.customerId}
                      className="border-t hover:bg-[var(--panel-strong)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="py-2.5">
                        <Link
                          href={`/app/customers/${c.customerId}`}
                          className="font-medium hover:underline"
                        >
                          {c.customerName}
                        </Link>
                      </td>
                      <td className="py-2.5 text-end font-semibold tabular-nums">
                        {formatSAR(c.outstanding)}
                      </td>
                      <td className="py-2.5 text-end tabular-nums">
                        {formatNumber(c.invoiceCount)}
                      </td>
                      <td className="py-2.5 text-end tabular-nums">
                        {formatNumber(c.oldestInvoiceDays)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            background:
                              c.bucket === "90+"
                                ? "var(--tone-blocked-bg, #fee)"
                                : "var(--panel-strong)",
                            color:
                              c.bucket === "90+"
                                ? "var(--tone-blocked-fg, #c00)"
                                : "var(--foreground)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {BUCKET_LABELS_AR[c.bucket]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden mt-4 flex flex-col gap-2" role="list">
              {filteredCustomers.map((c) => (
                <li key={c.customerId}>
                  <Link
                    href={`/app/customers/${c.customerId}`}
                    className="block rounded-xl border bg-[var(--panel-strong)] p-3 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring,#0ea5e9)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm truncate">
                        {c.customerName}
                      </div>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
                        style={{
                          background:
                            c.bucket === "90+"
                              ? "var(--tone-blocked-bg, #fee)"
                              : "var(--panel-strong)",
                          color:
                            c.bucket === "90+"
                              ? "var(--tone-blocked-fg, #c00)"
                              : "var(--foreground)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {BUCKET_LABELS_AR[c.bucket]}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>
                        {formatNumber(c.invoiceCount)} فاتورة · أقدمها{" "}
                        {formatNumber(c.oldestInvoiceDays)} يوم
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">
                        {formatSAR(c.outstanding)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
