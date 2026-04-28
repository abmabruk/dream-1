"use client";

/**
 * FinancePanel — renders inside the Project Hub finance tab. Shows
 * 4 metric cards, a stacked category bar, and the costs table. Add/delete
 * are gated by `canManageCosts`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  EmptyState,
  MetricCard,
  StatusPill,
  useToast,
} from "@/components/ui";
import { toneVars } from "@/lib/status-tone";
import { formatDateAr, formatSAR } from "@/lib/format";
import {
  COST_CATEGORY_LABELS_AR,
  COST_CATEGORY_TONE,
  COST_CATEGORY_VALUES,
  type CostListItem,
  type ProjectCostSummary,
} from "@/modules/finance/cost.schemas";
import type { StageInstanceItem } from "@/modules/projects/project.schemas";

import { AddCostDialog } from "./add-cost-dialog";

interface FinancePanelProps {
  projectId: string;
  projectCode: string;
  canManageCosts: boolean;
  tasks: { id: string; title: string }[];
  stageInstances?: StageInstanceItem[];
  defaultStageInstanceId?: string | null;
}

// Stage palette — uses accent variations so charts stay on-brand without
// adding new design tokens. Index by sortOrder modulo palette length.
const STAGE_PALETTE = [
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
];

function stageColor(idx: number): string {
  return STAGE_PALETTE[idx % STAGE_PALETTE.length];
}

function fmtMoney(value: string | null | undefined): string {
  return formatSAR(value);
}

function fmtDate(value: string | null | undefined): string {
  return formatDateAr(value);
}

export function FinancePanel({
  projectId,
  projectCode,
  canManageCosts,
  tasks,
  stageInstances = [],
  defaultStageInstanceId = null,
}: FinancePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [costs, setCosts] = useState<CostListItem[]>([]);
  const [summary, setSummary] = useState<ProjectCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/costs`, {
        cache: "no-store",
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر تحميل التكاليف", "error");
        return;
      }
      setCosts(json.data.costs as CostListItem[]);
      setSummary(json.data.summary as ProjectCostSummary);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (costId: string) => {
      if (!confirm("هل تريد فعلاً حذف هذه التكلفة؟")) return;
      try {
        const r = await fetch(
          `/api/v1/projects/${projectId}/costs/${costId}`,
          { method: "DELETE" },
        );
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر الحذف", "error");
          return;
        }
        toast("✓ حُذفت التكلفة", "success");
        await load();
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      }
    },
    [projectId, toast, load, router],
  );

  const totals = useMemo(() => {
    if (!summary) {
      return {
        quoted: null as string | null,
        cost: "0",
        margin: null as string | null,
        completion: 0,
        marginIsNegative: false,
      };
    }
    const marginIsNegative = summary.marginExpected
      ? Number(summary.marginExpected) < 0
      : false;
    return {
      quoted: summary.quotedAmount,
      cost: summary.totalCost,
      margin: summary.marginExpected,
      completion: summary.completionPercent,
      marginIsNegative,
    };
  }, [summary]);

  const categoryEntries = useMemo(() => {
    if (!summary) return [];
    const total = Number(summary.totalCost) || 0;
    return COST_CATEGORY_VALUES.map((cat) => {
      const v = Number(summary.costsByCategory[cat] || 0);
      return {
        category: cat,
        value: v,
        pct: total === 0 ? 0 : (v / total) * 100,
      };
    }).filter((e) => e.value > 0);
  }, [summary]);

  const stageEntries = useMemo(() => {
    if (!summary || !summary.costsByStage) return [];
    return summary.costsByStage
      .filter((e) => Number(e.total) > 0)
      .map((e, idx) => ({
        ...e,
        color: stageColor(idx),
      }));
  }, [summary]);

  const insightLine = useMemo(() => {
    if (stageEntries.length === 0) return null;
    const top = [...stageEntries].sort(
      (a, b) => Number(b.total) - Number(a.total),
    )[0];
    if (!top || top.pct < 10) return null;
    // Cycle days are sourced from the loaded stageInstances when matched.
    const inst = top.stageInstanceId
      ? stageInstances.find((s) => s.id === top.stageInstanceId)
      : null;
    let cycleText = "";
    if (inst && inst.startedAt) {
      const start = new Date(inst.startedAt).getTime();
      const end = inst.completedAt ? new Date(inst.completedAt).getTime() : Date.now();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        const days = Math.max(1, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
        cycleText = ` ومتوسطها ${days} يوم`;
      }
    }
    return `مرحلة "${top.stageName}" تأخذ ${top.pct.toFixed(0)}٪ من التكاليف${cycleText}.`;
  }, [stageEntries, stageInstances]);

  return (
    <section className="space-y-5">
      {/* Top metrics */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="المبلغ المعروض"
          value={fmtMoney(totals.quoted)}
          tone={totals.quoted ? "default" : "muted"}
          sublabel={totals.quoted ? "من الطلب المرتبط" : "لا يوجد طلب مسعّر"}
        />
        <MetricCard
          label="إجمالي التكاليف"
          value={fmtMoney(totals.cost)}
          tone={Number(totals.cost) > 0 ? "warn" : "muted"}
          sublabel={`${costs.length} مدخل`}
        />
        <MetricCard
          label="الهامش المتوقع"
          value={fmtMoney(totals.margin)}
          tone={totals.marginIsNegative ? "danger" : totals.margin ? "accent" : "muted"}
          sublabel={
            totals.marginIsNegative
              ? "تجاوزت التكاليف المبلغ المعروض"
              : totals.margin
                ? "متوقع"
                : "بانتظار سعر معروض"
          }
        />
        <MetricCard
          label="نسبة الإنجاز المالي"
          value={`${totals.completion}%`}
          tone={totals.completion >= 100 ? "accent" : "default"}
          sublabel="مبني على إنجاز المهام"
        />
      </div>

      {/* By-stage breakdown — Wave 3 */}
      {stageEntries.length > 0 ? (
        <div className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">التكاليف حسب المرحلة</h3>
            <span className="text-xs text-[var(--muted-foreground)]">
              {stageEntries.length} مرحلة بتكاليف
            </span>
          </div>
          <div
            className="mt-4 flex h-3 w-full overflow-hidden rounded-full"
            style={{ background: "var(--panel-strong)" }}
            aria-label="توزيع التكاليف حسب المرحلة"
          >
            {stageEntries.map((e) => (
              <div
                key={e.stageInstanceId ?? "_none"}
                style={{ width: `${e.pct}%`, background: e.color }}
                title={`${e.stageName} — ${fmtMoney(e.total)}`}
              />
            ))}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <th className="py-2 text-start">المرحلة</th>
                  <th className="py-2 text-end">المبلغ</th>
                  <th className="py-2 text-end">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {stageEntries.map((e) => (
                  <tr
                    key={e.stageInstanceId ?? "_none"}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ background: e.color }}
                        />
                        {e.stageName}
                      </span>
                    </td>
                    <td className="py-2.5 text-end font-semibold tabular-nums">
                      {fmtMoney(e.total)}
                    </td>
                    <td className="py-2.5 text-end tabular-nums">
                      {e.pct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {insightLine ? (
            <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {insightLine}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Category breakdown bar */}
      <div className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">تفصيل التكاليف بحسب الفئة</h3>
          {canManageCosts ? (
            <button
              type="button"
              className="button-primary text-sm"
              onClick={() => setShowAdd(true)}
            >
              + تكلفة جديدة
            </button>
          ) : null}
        </div>
        {categoryEntries.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            لا توجد تكاليف بعد لرسم التفصيل.
          </p>
        ) : (
          <>
            <div
              className="mt-4 flex h-3 w-full overflow-hidden rounded-full"
              style={{ background: "var(--panel-strong)" }}
              aria-label="تفصيل بصري للتكاليف"
            >
              {categoryEntries.map((e) => {
                const tone = COST_CATEGORY_TONE[e.category];
                const vars = toneVars(tone);
                return (
                  <div
                    key={e.category}
                    style={{
                      width: `${e.pct}%`,
                      background: vars.color,
                    }}
                    title={`${COST_CATEGORY_LABELS_AR[e.category]} — ${fmtMoney(String(e.value))}`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {categoryEntries.map((e) => {
                const tone = COST_CATEGORY_TONE[e.category];
                const vars = toneVars(tone);
                return (
                  <span
                    key={e.category}
                    className="inline-flex items-center gap-2 rounded-full border px-2 py-1"
                    style={{
                      borderColor: vars.borderColor,
                      background: vars.background,
                      color: vars.color,
                    }}
                  >
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: vars.color }}
                    />
                    {COST_CATEGORY_LABELS_AR[e.category]} ·{" "}
                    {fmtMoney(String(e.value))} ({e.pct.toFixed(0)}%)
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Costs table */}
      <div className="panel">
        <h3 className="text-base font-semibold">سجل التكاليف</h3>
        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            جاري التحميل…
          </p>
        ) : costs.length === 0 ? (
          <EmptyState
            heading="لا توجد تكاليف بعد"
            description="ابدأ بإضافة أول تكلفة لهذا المشروع — مادة، عمالة، أو خدمة."
            action={
              canManageCosts ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setShowAdd(true)}
                >
                  + إضافة تكلفة
                </button>
              ) : null
            }
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <th className="py-2 text-start">التاريخ</th>
                  <th className="py-2 text-start">الفئة</th>
                  <th className="py-2 text-start">الوصف</th>
                  <th className="py-2 text-start">المورد</th>
                  <th className="py-2 text-end">المبلغ</th>
                  {canManageCosts ? (
                    <th className="py-2 text-end">إجراءات</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => {
                  const tone = COST_CATEGORY_TONE[c.category];
                  return (
                    <tr
                      key={c.id}
                      className="border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="py-2.5">{fmtDate(c.incurredAt)}</td>
                      <td className="py-2.5">
                        <StatusPill
                          status={c.category}
                          label={COST_CATEGORY_LABELS_AR[c.category]}
                          tone={tone}
                          size="sm"
                        />
                      </td>
                      <td className="py-2.5">{c.description}</td>
                      <td className="py-2.5 text-[var(--muted-foreground)]">
                        {c.vendorName ?? "—"}
                      </td>
                      <td className="py-2.5 text-end font-semibold tabular-nums">
                        {fmtMoney(c.amount)}
                      </td>
                      {canManageCosts ? (
                        <td className="py-2.5 text-end">
                          <button
                            type="button"
                            className="button-danger inline-flex items-center gap-1.5 text-xs"
                            style={{ height: "2rem", paddingInline: "0.75rem" }}
                            onClick={() => handleDelete(c.id)}
                            aria-label="حذف التكلفة"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                            </svg>
                            حذف
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && canManageCosts ? (
        <AddCostDialog
          projectId={projectId}
          projectCode={projectCode}
          tasks={tasks}
          stageInstances={stageInstances}
          defaultStageInstanceId={defaultStageInstanceId}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            toast("✓ أُضيفت التكلفة", "success");
            await load();
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

export default FinancePanel;
