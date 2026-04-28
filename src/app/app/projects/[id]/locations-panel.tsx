"use client";

/**
 * Wave 4 — Locations panel for the Project Hub.
 *
 * Shows project locations as cards with task counts, supports add/edit/delete,
 * cloning a template room N times, and reordering via ↑↓ buttons.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, useToast } from "@/components/ui";
import type { LocationItem } from "@/modules/projects/project.schemas";

interface LocationsPanelProps {
  projectId: string;
  locations: LocationItem[];
  canManage: boolean;
}

async function jsonRequest(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const p = (await r.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(p?.error?.message || "فشل الطلب.");
  }
  return r.json().catch(() => null);
}

export function LocationsPanel({
  projectId,
  locations,
  canManage,
}: LocationsPanelProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add/edit form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIsTemplate, setFormIsTemplate] = useState(false);

  // Clone state
  const [cloneCount, setCloneCount] = useState(1);
  const [clonePrefix, setClonePrefix] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormNotes("");
    setFormIsTemplate(false);
  };

  const startEdit = (loc: LocationItem) => {
    setEditingId(loc.id);
    setShowAdd(false);
    setFormName(loc.name);
    setFormCode(loc.code ?? "");
    setFormNotes(loc.notes ?? "");
    setFormIsTemplate(loc.isTemplate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast("الاسم مطلوب", "error");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await jsonRequest(
          `/api/v1/projects/${projectId}/locations/${editingId}`,
          "PATCH",
          {
            name: formName.trim(),
            code: formCode.trim() || null,
            notes: formNotes.trim() || null,
            isTemplate: formIsTemplate,
          },
        );
        toast("تم حفظ الموقع", "success");
        setEditingId(null);
      } else {
        await jsonRequest(`/api/v1/projects/${projectId}/locations`, "POST", {
          name: formName.trim(),
          code: formCode.trim() || undefined,
          notes: formNotes.trim() || undefined,
          isTemplate: formIsTemplate,
        });
        toast("تمت إضافة الموقع", "success");
        setShowAdd(false);
      }
      resetForm();
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "تعذّر الحفظ", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (loc: LocationItem) => {
    if (!confirm(`حذف الموقع "${loc.name}"؟`)) return;
    setBusy(true);
    try {
      await jsonRequest(
        `/api/v1/projects/${projectId}/locations/${loc.id}`,
        "DELETE",
      );
      toast("تم حذف الموقع", "success");
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "تعذّر الحذف", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async () => {
    if (!cloneSourceId) return;
    setBusy(true);
    try {
      await jsonRequest(
        `/api/v1/projects/${projectId}/locations/${cloneSourceId}/clone`,
        "POST",
        {
          count: cloneCount,
          namePrefix: clonePrefix.trim() || undefined,
        },
      );
      toast(
        cloneCount > 1 ? `تم استنساخ ${cloneCount} مواقع` : "تم استنساخ الموقع",
        "success",
      );
      setCloneSourceId(null);
      setCloneCount(1);
      setClonePrefix("");
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "تعذّر الاستنساخ", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, dir: "up" | "down") => {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= locations.length) return;
    const ids = locations.map((l) => l.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      await jsonRequest(
        `/api/v1/projects/${projectId}/locations/reorder`,
        "POST",
        { orderedIds: ids },
      );
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "تعذّر الترتيب", "error");
    } finally {
      setBusy(false);
    }
  };

  const renderForm = (mode: "add" | "edit") => (
    <form onSubmit={handleSubmit} className="panel space-y-3" key={mode}>
      <h3 className="text-sm font-semibold">
        {mode === "edit" ? "تعديل موقع" : "موقع جديد"}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="loc-name">
            الاسم<span className="field-required" aria-hidden>*</span>
          </label>
          <input
            id="loc-name"
            className="input-field"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            maxLength={160}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="loc-code">
            الرمز
          </label>
          <input
            id="loc-code"
            className="input-field"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
            maxLength={40}
            placeholder="مثلاً: B1"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="loc-notes">
          ملاحظات
        </label>
        <textarea
          id="loc-notes"
          className="input-field min-h-20"
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          maxLength={2000}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={formIsTemplate}
          onChange={(e) => setFormIsTemplate(e.target.checked)}
        />
        قالب قابل للاستنساخ (مثل: غرفة نوم قياسية)
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="button-primary"
          disabled={busy}
        >
          {busy ? "جاري الحفظ..." : "حفظ"}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            if (mode === "edit") setEditingId(null);
            else setShowAdd(false);
            resetForm();
          }}
        >
          إلغاء
        </button>
      </div>
    </form>
  );

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">المواقع</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {locations.length} موقع · يمكن تخصيص المهام لكل موقع
          </p>
        </div>
        {canManage && !showAdd && editingId === null ? (
          <button
            type="button"
            className="button-primary"
            onClick={() => setShowAdd(true)}
          >
            + إضافة موقع
          </button>
        ) : null}
      </div>

      {showAdd ? renderForm("add") : null}

      {locations.length === 0 && !showAdd ? (
        <EmptyState
          heading="لا توجد مواقع بعد"
          description="ابدأ بإضافة مواقع المشروع (غرف، طوابق، مبانٍ...)"
          action={
            canManage ? (
              <button
                type="button"
                className="button-primary"
                onClick={() => setShowAdd(true)}
              >
                + أضف أول موقع
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc, index) =>
            editingId === loc.id ? (
              <div key={loc.id} className="md:col-span-2 xl:col-span-3">
                {renderForm("edit")}
              </div>
            ) : (
              <div
                key={loc.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold truncate">
                        {loc.name}
                      </h3>
                      {loc.code ? (
                        <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-[1px] text-[0.65rem] text-[var(--muted-foreground)]">
                          {loc.code}
                        </span>
                      ) : null}
                      {loc.isTemplate ? (
                        <span
                          className="rounded-full px-2 py-[1px] text-[0.65rem] font-medium"
                          style={{
                            background: "var(--tone-active-bg)",
                            color: "var(--tone-active-fg)",
                          }}
                        >
                          قالب
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs flex-shrink-0"
                    style={{
                      background: "var(--accent-subtle)",
                      color: "var(--accent)",
                    }}
                    title="عدد المهام"
                  >
                    {loc.taskCount} مهمة
                  </span>
                </div>
                {loc.notes ? (
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                    {loc.notes}
                  </p>
                ) : null}
                {canManage ? (
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] hover:underline"
                      onClick={() => startEdit(loc)}
                    >
                      تعديل
                    </button>
                    <span className="text-xs text-[var(--muted-foreground)]">·</span>
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] hover:underline"
                      onClick={() => {
                        setCloneSourceId(loc.id);
                        setCloneCount(1);
                        setClonePrefix(loc.name);
                      }}
                    >
                      استنساخ
                    </button>
                    <span className="text-xs text-[var(--muted-foreground)]">·</span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      onClick={() => handleDelete(loc)}
                      disabled={loc.taskCount > 0}
                      title={
                        loc.taskCount > 0
                          ? "لا يمكن حذف موقع به مهام"
                          : "حذف"
                      }
                    >
                      حذف
                    </button>
                    <span className="ms-auto inline-flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-xs disabled:opacity-40"
                        onClick={() => handleMove(index, "up")}
                        disabled={busy || index === 0}
                        aria-label="نقل لأعلى"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-xs disabled:opacity-40"
                        onClick={() => handleMove(index, "down")}
                        disabled={busy || index === locations.length - 1}
                        aria-label="نقل لأسفل"
                      >
                        ↓
                      </button>
                    </span>
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}

      {cloneSourceId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setCloneSourceId(null)}
        >
          <div
            className="panel max-w-md w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">استنساخ الموقع</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              يمكنك إنشاء عدة نسخ دفعة واحدة. مثلاً: غرفة 1، غرفة 2...
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="clone-count">
                  عدد النسخ
                </label>
                <input
                  id="clone-count"
                  type="number"
                  min={1}
                  max={10}
                  className="input-field"
                  value={cloneCount}
                  onChange={(e) =>
                    setCloneCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="clone-prefix">
                  بادئة الاسم
                </label>
                <input
                  id="clone-prefix"
                  className="input-field"
                  value={clonePrefix}
                  onChange={(e) => setClonePrefix(e.target.value)}
                  placeholder="غرفة"
                />
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              ستُسمى المواقع: <span className="font-mono">{(clonePrefix || "نسخة")} 1, {(clonePrefix || "نسخة")} 2, ...</span>
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setCloneSourceId(null)}
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleClone}
                disabled={busy}
              >
                {busy ? "جاري الاستنساخ..." : "استنساخ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
