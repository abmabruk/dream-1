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
import { formatSAR } from "@/lib/format";
import {
  COST_CATEGORY_LABELS_AR,
  COST_CATEGORY_VALUES,
  type CostCategory,
} from "@/modules/finance/cost.schemas";
import type { StageInstanceItem } from "@/modules/projects/project.schemas";

export interface AvailableQuoteLine {
  id: string;
  description: string;
  quoteVersion: number;
  quoteStatus: string;
  unitPrice: string;
  quantity: string;
}

const STAGE_STATUS_LABELS_AR: Record<string, string> = {
  NOT_STARTED: "لم تبدأ",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متوقفة",
  COMPLETED: "مكتملة",
  SKIPPED: "متجاوزة",
};

export interface AvailableVendor {
  id: string;
  name: string;
  code: string | null;
}

interface AddCostDialogProps {
  projectId: string;
  projectCode: string;
  tasks: { id: string; title: string }[];
  stageInstances?: StageInstanceItem[];
  defaultStageInstanceId?: string | null;
  locations?: { id: string; name: string; code: string | null }[];
  availableQuoteLines?: AvailableQuoteLine[];
  availableVendors?: AvailableVendor[];
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
  locations = [],
  availableQuoteLines = [],
  availableVendors = [],
  onClose,
  onCreated,
}: AddCostDialogProps) {
  const isMobile = useIsMobile();
  const [category, setCategory] = useState<CostCategory>("MATERIAL");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorSuggestOpen, setVendorSuggestOpen] = useState(false);
  const [vendorList, setVendorList] = useState<AvailableVendor[]>(availableVendors);
  const [showQuickVendor, setShowQuickVendor] = useState(false);
  const [quickVendorName, setQuickVendorName] = useState("");
  const [quickVendorPhone, setQuickVendorPhone] = useState("");
  const [quickVendorSaving, setQuickVendorSaving] = useState(false);
  const [quickVendorError, setQuickVendorError] = useState<string | null>(null);

  // Re-sync local vendor list whenever the parent passes a new array.
  useEffect(() => {
    setVendorList(availableVendors);
  }, [availableVendors]);

  const vendorMatches = vendorQuery.trim().length === 0
    ? vendorList.slice(0, 8)
    : vendorList
        .filter((v) => {
          const q = vendorQuery.trim().toLowerCase();
          return (
            v.name.toLowerCase().includes(q) ||
            (v.code ?? "").toLowerCase().includes(q)
          );
        })
        .slice(0, 8);

  function pickVendor(v: AvailableVendor) {
    setVendorId(v.id);
    setVendor(v.name);
    setVendorQuery(v.name);
    setVendorSuggestOpen(false);
  }

  function clearVendorPick() {
    setVendorId(null);
  }

  async function submitQuickVendor() {
    setQuickVendorError(null);
    if (quickVendorName.trim().length < 2) {
      setQuickVendorError("اكتب اسم المورد");
      return;
    }
    setQuickVendorSaving(true);
    try {
      const r = await fetch(`/api/v1/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickVendorName.trim(),
          phone: quickVendorPhone.trim() || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        setQuickVendorError(json?.error?.message ?? "تعذّر إنشاء المورد");
        return;
      }
      const created = json.data as { id: string; name: string; code: string | null };
      const newVendor: AvailableVendor = {
        id: created.id,
        name: created.name,
        code: created.code ?? null,
      };
      setVendorList((prev) => [newVendor, ...prev.filter((v) => v.id !== newVendor.id)]);
      pickVendor(newVendor);
      setShowQuickVendor(false);
      setQuickVendorName("");
      setQuickVendorPhone("");
    } catch (e) {
      setQuickVendorError(e instanceof Error ? e.message : "خطأ في الاتصال");
    } finally {
      setQuickVendorSaving(false);
    }
  }
  const [taskId, setTaskId] = useState<string>("");
  const [stageInstanceId, setStageInstanceId] = useState<string>(
    defaultStageInstanceId ?? "",
  );
  const [locationId, setLocationId] = useState<string>("");
  const [quoteLineId, setQuoteLineId] = useState<string>("");
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
          vendorId: vendorId ?? undefined,
          vendorName: vendor.trim() || undefined,
          taskId: taskId || undefined,
          stageInstanceId: stageInstanceId || undefined,
          locationId: locationId || undefined,
          quoteLineId: quoteLineId || undefined,
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
        <div className="block text-sm">
          <div className="flex items-center justify-between">
            <span>المورد (اختياري)</span>
            <button
              type="button"
              onClick={() => setShowQuickVendor((v) => !v)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              + مورد جديد سريع
            </button>
          </div>
          <div className="relative mt-1">
            <input
              value={vendorQuery}
              onChange={(e) => {
                setVendorQuery(e.target.value);
                setVendor(e.target.value);
                if (vendorId) clearVendorPick();
                setVendorSuggestOpen(true);
              }}
              onFocus={() => setVendorSuggestOpen(true)}
              onBlur={() => setTimeout(() => setVendorSuggestOpen(false), 150)}
              placeholder={vendorList.length > 0 ? "ابحث أو اكتب اسم المورد" : "اسم المورد"}
              className="w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
              style={{ borderColor: "var(--border)" }}
            />
            {vendorId ? (
              <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] rounded-full bg-[var(--tone-planned-bg)] px-2 py-0.5 text-[var(--tone-planned-fg)]">
                مرتبط
              </span>
            ) : null}
            {vendorSuggestOpen && vendorMatches.length > 0 ? (
              <ul
                className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-[var(--panel)] shadow-lg"
                style={{ borderColor: "var(--border)" }}
                role="listbox"
              >
                {vendorMatches.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickVendor(v);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-[var(--panel-strong)]"
                    >
                      <span>{v.name}</span>
                      {v.code ? (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {v.code}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {showQuickVendor ? (
            <div
              className="mt-2 space-y-2 rounded-xl border border-dashed p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <input
                value={quickVendorName}
                onChange={(e) => setQuickVendorName(e.target.value)}
                placeholder="اسم المورد"
                className="w-full rounded-lg border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[40px]"
                style={{ borderColor: "var(--border)" }}
              />
              <input
                value={quickVendorPhone}
                onChange={(e) => setQuickVendorPhone(e.target.value)}
                placeholder="رقم الجوال (اختياري)"
                inputMode="tel"
                className="w-full rounded-lg border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[40px]"
                style={{ borderColor: "var(--border)" }}
              />
              {quickVendorError ? (
                <p className="text-xs text-[var(--tone-blocked-fg)]">
                  {quickVendorError}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickVendor(false);
                    setQuickVendorError(null);
                  }}
                  className="text-xs text-[var(--muted-foreground)] hover:underline"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={submitQuickVendor}
                  disabled={quickVendorSaving}
                  className="button-secondary text-xs disabled:opacity-60"
                >
                  {quickVendorSaving ? "جاري الحفظ…" : "إضافة سريعة"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
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

      {locations && locations.length > 0 ? (
        <label className="block text-sm">
          الموقع (اختياري)
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— بدون موقع —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}{l.code ? ` · ${l.code}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {availableQuoteLines.length > 0 ? (
        <label className="block text-sm">
          اربط ببند عرض سعر (اختياري)
          <select
            value={quoteLineId}
            onChange={(e) => setQuoteLineId(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— بدون ربط —</option>
            {availableQuoteLines.map((l) => {
              const sell = Number(l.unitPrice) * Number(l.quantity);
              return (
                <option key={l.id} value={l.id}>
                  {`v${l.quoteVersion}: ${l.description} (سعر: ${formatSAR(sell.toFixed(2))})`}
                </option>
              );
            })}
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
