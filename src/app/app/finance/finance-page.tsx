"use client";

/**
 * FinancePage — global financial dashboard. Lists every project ranked
 * by margin with monthly + category filters and CSV export.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  EmptyState,
  MetricCard,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import {
  COST_CATEGORY_LABELS_AR,
  COST_CATEGORY_VALUES,
  type CostCategory,
  type FactoryCostSummary,
} from "@/modules/finance/cost.schemas";
import { formatSAR } from "@/lib/format";

interface FinancePageProps {
  summary: FactoryCostSummary;
  canManageCosts: boolean;
  defaultFrom: string;
  defaultTo: string;
  defaultCategories: CostCategory[];
}

function fmtMoney(value: string | null | undefined): string {
  return formatSAR(value);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function FinancePage({
  summary,
  canManageCosts,
  defaultFrom,
  defaultTo,
  defaultCategories,
}: FinancePageProps) {
  const router = useRouter();

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [categories, setCategories] = useState<CostCategory[]>(defaultCategories);
  const [search, setSearch] = useState("");

  const totals = useMemo(
    () => ({
      quoted: summary.totalQuoted,
      cost: summary.totalCost,
      margin: summary.totalMargin,
      overBudget: summary.overBudgetCount,
    }),
    [summary],
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summary.projects;
    return summary.projects.filter(
      (p) =>
        p.projectCode.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        (p.customerName ?? "").toLowerCase().includes(q),
    );
  }, [summary.projects, search]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (categories.length > 0) params.set("categories", categories.join(","));
    router.push(`/app/finance?${params.toString()}`);
  }, [from, to, categories, router]);

  const exportCsv = useCallback(() => {
    const headers = [
      "Project",
      "Code",
      "Customer",
      "Quoted (SAR)",
      "Costs (SAR)",
      "Margin (SAR)",
      "Status",
    ];
    const rows = filteredProjects.map((p) => [
      p.projectName,
      p.projectCode,
      p.customerName ?? "",
      p.quotedAmount ?? "",
      p.totalCost,
      p.margin ?? "",
      p.status,
    ]);
    const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
    const csv = "﻿" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-${from}-to-${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredProjects, from, to]);

  const toggleCategory = useCallback((cat: CostCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  return (
    <main className="space-y-6">
      <PageHeader
        caption="الماليات"
        title="نظرة شاملة على التكاليف والهامش"
        description={`لوحة الماليات تجمع كل المشاريع، مرتبة حسب الهامش، مع إمكانية تصفية حسب الشهر والفئة.${canManageCosts ? "" : " (وضع للقراءة فقط)"}`}
        actions={
          <button type="button" className="button-secondary" onClick={exportCsv}>
            تصدير CSV
          </button>
        }
      />

      {/* KPIs */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي المعروض" value={fmtMoney(totals.quoted)} />
        <MetricCard
          label="إجمالي التكاليف"
          value={fmtMoney(totals.cost)}
          tone="warn"
        />
        <MetricCard
          label="الهامش الكلي"
          value={fmtMoney(totals.margin)}
          tone={Number(totals.margin) < 0 ? "danger" : "accent"}
        />
        <MetricCard
          label="مشاريع تجاوزت الميزانية"
          value={totals.overBudget}
          tone={totals.overBudget > 0 ? "danger" : "muted"}
        />
      </section>

      {/* Filters */}
      <section className="panel">
        <div className="grid gap-3 md:grid-cols-4">
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
          <label className="block text-sm md:col-span-2">
            بحث في المشاريع
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اكتب اسم المشروع أو رمزه أو اسم العميل"
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)]">الفئات:</span>
          {COST_CATEGORY_VALUES.map((c) => {
            const active = categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className="rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent)" : "var(--panel-strong)",
                  color: active ? "var(--accent-foreground)" : "var(--foreground)",
                }}
              >
                {COST_CATEGORY_LABELS_AR[c]}
              </button>
            );
          })}
          <div className="ms-auto">
            <button
              type="button"
              className="button-primary text-sm"
              onClick={applyFilters}
            >
              تطبيق المرشحات
            </button>
          </div>
        </div>
      </section>

      {/* Invoices shortcut */}
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">الفواتير</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              إدارة الفواتير والإشعارات الدائنة وتتبّع المستحقات.
            </p>
          </div>
          <Link
            href="/app/finance/invoices"
            className="text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            عرض الكل ←
          </Link>
        </div>
      </section>

      {/* Payments shortcut */}
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">المدفوعات</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              تسجيل دفعات العملاء وتوزيعها على الفواتير المفتوحة.
            </p>
          </div>
          <Link
            href="/app/finance/payments"
            className="text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            عرض الكل ←
          </Link>
        </div>
      </section>

      {/* Projects table */}
      <section className="panel">
        <h2 className="text-lg font-semibold">المشاريع مرتبة حسب الهامش</h2>
        {filteredProjects.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              heading="لا توجد مشاريع لعرضها"
              description="جرّب توسيع المدى الزمني أو إزالة بعض المرشحات."
            />
          </div>
        ) : (
          <>
          {/* Mobile card list */}
          <ul className="mt-4 flex flex-col gap-3 md:hidden">
            {filteredProjects.map((p) => (
              <FinanceRowCard key={p.projectId} project={p} />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <th className="py-2 text-start">المشروع</th>
                  <th className="py-2 text-start">العميل</th>
                  <th className="py-2 text-end">المعروض</th>
                  <th className="py-2 text-end">التكاليف</th>
                  <th className="py-2 text-end">الهامش</th>
                  <th className="py-2 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => {
                  const negativeMargin = p.margin && Number(p.margin) < 0;
                  return (
                    <tr
                      key={p.projectId}
                      className="cursor-pointer border-t hover:bg-[var(--panel-strong)]"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() =>
                        router.push(
                          `/app/projects/${p.projectId}?tab=finance`,
                        )
                      }
                    >
                      <td className="py-2.5">
                        <Link
                          href={`/app/projects/${p.projectId}?tab=finance`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.projectCode} · {p.projectName}
                        </Link>
                      </td>
                      <td className="py-2.5 text-[var(--muted-foreground)]">
                        {p.customerName ?? "—"}
                      </td>
                      <td className="py-2.5 text-end tabular-nums">
                        {fmtMoney(p.quotedAmount)}
                      </td>
                      <td className="py-2.5 text-end tabular-nums">
                        {fmtMoney(p.totalCost)}
                      </td>
                      <td
                        className="py-2.5 text-end font-semibold tabular-nums"
                        style={{
                          color: negativeMargin
                            ? "var(--tone-blocked-fg)"
                            : "var(--foreground)",
                        }}
                      >
                        {fmtMoney(p.margin)}
                      </td>
                      <td className="py-2.5">
                        <StatusPill status={p.status} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </main>
  );
}


/**
 * Lightweight card representation of a finance row, used on mobile in
 * place of the wide six-column table.
 */
function FinanceRowCard({
  project,
}: {
  project: FactoryCostSummary["projects"][number];
}) {
  const negativeMargin = project.margin && Number(project.margin) < 0;
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/app/projects/${project.projectId}?tab=finance`}
          className="font-semibold hover:underline"
        >
          {project.projectCode} · {project.projectName}
        </Link>
        <StatusPill status={project.status} size="sm" />
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        {project.customerName ?? "—"}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-[var(--muted-foreground)]">المعروض</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {fmtMoney(project.quotedAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">التكاليف</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {fmtMoney(project.totalCost)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">الهامش</dt>
          <dd
            className="mt-0.5 font-semibold tabular-nums"
            style={{
              color: negativeMargin
                ? "var(--tone-blocked-fg)"
                : "var(--foreground)",
            }}
          >
            {fmtMoney(project.margin)}
          </dd>
        </div>
      </dl>
    </li>
  );
}
