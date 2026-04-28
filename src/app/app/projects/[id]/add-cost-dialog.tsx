"use client";

/**
 * AddCostDialog — modal for creating a ProjectCost.
 *
 * Phase 7: on mobile the dialog renders as a `<BottomSheet>` for a
 * comfortable on-phone form; on desktop the original centered modal
 * is preserved.
 */

import { useEffect, useRef, useState } from "react";

import { BottomSheet } from "@/components/ui";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import {
  COST_CATEGORY_LABELS_AR,
  COST_CATEGORY_VALUES,
  type CostCategory,
} from "@/modules/finance/cost.schemas";
import type { StageInstanceItem } from "@/modules/projects/project.schemas";

const STAGE_STATUS_LABELS_AR: Record<string, string> = {
  NOT_STARTED: "لم تبدأ",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متوقفة",
  COMPLETED: "مكتملة",
  SKIPPED: "متجاوزة",
};

interface AddCostDialogProps {
  projectId: string;
  projectCode: string;
  tasks: { id: string; title: string }[];
  stageInstances?: StageInstanceItem[];
  defaultStageInstanceId?: string | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AddCostDialog({
  projectId,
  projectCode,
  tasks,
  stageInstances = [],
  defaultStageInstanceId = null,
  onClose,
  onCreated,
}: AddCostDialogProps) {
  const isMobile = useIsMobile();
  const [category, setCategory] = useState<CostCategory>("MATERIAL");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [taskId, setTaskId] = useState<string>("");
  const [stageInstanceId, setStageInstanceId] = useState<string>(
    defaultStageInstanceId ?? "",
  );
  const [incurredAt, setIncurredAt] = useState<string>(todayDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 30);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("اكتب مبلغًا صحيحًا أكبر من صفر");
      return;
    }
    if (description.trim().length < 2) {
      setError("اكتب وصفًا قصيرًا للتكلفة");
      return;
    }

    setSaving(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          amount: amt,
          description: description.trim(),
          vendorName: vendor.trim() || undefined,
          taskId: taskId || undefined,
          stageInstanceId: stageInstanceId || undefined,
          incurredAt: new Date(incurredAt).toISOString(),
        }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        setError(json?.error?.message ?? "فشل حفظ التكلفة");
        return;
      }
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  const formBody = (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          الفئة
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CostCategory)}
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          >
            {COST_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {COST_CATEGORY_LABELS_AR[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          المبلغ (ر.س)
          <input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm tabular-nums min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
      </div>

      <label className="block text-sm">
        الوصف
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="مثال: شراء قماش جلد طبيعي"
          className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
          style={{ borderColor: "var(--border)" }}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          المورد (اختياري)
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="اسم المورد"
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="block text-sm">
          التاريخ
          <input
            type="date"
            value={incurredAt}
            onChange={(e) => setIncurredAt(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
      </div>

      {tasks.length > 0 ? (
        <label className="block text-sm">
          مهمة مرتبطة (اختياري)
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— بدون —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {stageInstances.length > 0 ? (
        <label className="block text-sm">
          المرحلة (اختياري)
          <select
            value={stageInstanceId}
            onChange={(e) => setStageInstanceId(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— بدون مرحلة —</option>
            {[...stageInstances]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {STAGE_STATUS_LABELS_AR[s.status] ?? s.status}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--tone-blocked-fg)]">{error}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--panel-strong)] min-h-[44px]"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={saving}
          className="button-primary text-sm disabled:opacity-60 min-h-[44px]"
        >
          {saving ? "جاري الحفظ…" : "حفظ"}
        </button>
      </div>
    </form>
  );

  // Mobile: BottomSheet variant.
  if (isMobile) {
    return (
      <BottomSheet
        open
        onClose={onClose}
        title={
          <span>
            <span className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {projectCode}
            </span>
            <span className="block">إضافة تكلفة</span>
          </span>
        }
      >
        {formBody}
      </BottomSheet>
    );
  }

  // Desktop: original centered modal.
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-cost-title"
        className="w-full max-w-lg rounded-2xl border bg-[var(--panel)] p-5 shadow-[0_24px_60px_rgba(20,14,4,0.32)]"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {projectCode}
            </p>
            <h2 id="add-cost-title" className="mt-1 text-xl font-semibold">
              إضافة تكلفة
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--muted-foreground)] hover:bg-[var(--panel-strong)]"
          >
            إغلاق
          </button>
        </div>

        <div className="mt-4">{formBody}</div>
      </div>
    </div>
  );
}
