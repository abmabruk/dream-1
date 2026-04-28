"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, PageHeader, useToast } from "@/components/ui";
import { INTERNAL_USER_ROLE_LABELS } from "@/modules/users/user-access";
import type { StageTemplateItem } from "@/modules/projects/stage-template.service";

const ROLE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "", label: "بدون دور افتراضي" },
  ...Object.entries(INTERNAL_USER_ROLE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

interface StagesAdminProps {
  initialStages: StageTemplateItem[];
}

interface EditDraft {
  name: string;
  expectedDays: string;
  ownerRole: string;
  isOptional: boolean;
  isActive: boolean;
  requiresDepositAttestation: boolean;
}

interface CreateDraft {
  name: string;
  expectedDays: string;
  ownerRole: string;
  isOptional: boolean;
  requiresDepositAttestation: boolean;
}

const EMPTY_CREATE_DRAFT: CreateDraft = {
  name: "",
  expectedDays: "",
  ownerRole: "",
  isOptional: false,
  requiresDepositAttestation: false,
};

export function StagesAdmin({ initialStages }: StagesAdminProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [stages, setStages] = useState(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const handleStartEdit = useCallback((stage: StageTemplateItem) => {
    setEditingId(stage.id);
    setEditDraft({
      name: stage.name,
      expectedDays: stage.expectedDays != null ? String(stage.expectedDays) : "",
      ownerRole: stage.ownerRole ?? "",
      isOptional: stage.isOptional,
      isActive: stage.isActive,
      requiresDepositAttestation: stage.requiresDepositAttestation,
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (stageId: string) => {
      if (!editDraft) return;
      setBusyId(stageId);
      try {
        const payload = {
          name: editDraft.name.trim(),
          expectedDays:
            editDraft.expectedDays.trim() === ""
              ? null
              : Number(editDraft.expectedDays),
          ownerRole: editDraft.ownerRole === "" ? null : editDraft.ownerRole,
          isOptional: editDraft.isOptional,
          isActive: editDraft.isActive,
          requiresDepositAttestation: editDraft.requiresDepositAttestation,
        };
        const res = await fetch(`/api/v1/settings/stages/${stageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errMsg = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errMsg.error ?? "تعذّر حفظ التعديل.");
        }
        const updated = (await res.json()) as { data: StageTemplateItem };
        setStages((prev) =>
          prev.map((row) => (row.id === stageId ? updated.data : row)),
        );
        setEditingId(null);
        setEditDraft(null);
        toast("تم حفظ التعديلات", "success");
        refresh();
      } catch (err) {
        toast(err instanceof Error ? `تعذّر الحفظ: ${err.message}` : `تعذّر الحفظ`, "error");
      } finally {
        setBusyId(null);
      }
    },
    [editDraft, refresh, toast],
  );

  const handleCreate = useCallback(async () => {
    if (createDraft.name.trim().length < 2) {
      toast("اسم المرحلة قصير جداً", "info");
      return;
    }
    setBusyId("__new__");
    try {
      const payload = {
        name: createDraft.name.trim(),
        expectedDays:
          createDraft.expectedDays.trim() === ""
            ? null
            : Number(createDraft.expectedDays),
        ownerRole: createDraft.ownerRole === "" ? null : createDraft.ownerRole,
        isOptional: createDraft.isOptional,
        requiresDepositAttestation: createDraft.requiresDepositAttestation,
      };
      const res = await fetch(`/api/v1/settings/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errMsg = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errMsg.error ?? "تعذّر إنشاء المرحلة.");
      }
      const created = (await res.json()) as { data: StageTemplateItem };
      setStages((prev) =>
        [...prev, created.data].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setCreateDraft(EMPTY_CREATE_DRAFT);
      setShowCreate(false);
      toast("تم إنشاء المرحلة", "success");
      refresh();
    } catch (err) {
      toast(err instanceof Error ? `تعذّر الإنشاء: ${err.message}` : `تعذّر الإنشاء`, "error");
    } finally {
      setBusyId(null);
    }
  }, [createDraft, refresh, toast]);

  const handleMove = useCallback(
    async (stageId: string, direction: "up" | "down") => {
      const idx = stages.findIndex((row) => row.id === stageId);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= stages.length) return;
      const reordered = [...stages];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(targetIdx, 0, moved);
      setStages(reordered);
      setBusyId(stageId);
      try {
        const res = await fetch(`/api/v1/settings/stages/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderedIds: reordered.map((row) => row.id),
          }),
        });
        if (!res.ok) throw new Error("تعذّر تغيير الترتيب.");
        refresh();
      } catch (err) {
        // Rollback.
        setStages(stages);
        toast(err instanceof Error ? `تعذّر تغيير الترتيب: ${err.message}` : `تعذّر تغيير الترتيب`, "error");
      } finally {
        setBusyId(null);
      }
    },
    [stages, refresh, toast],
  );

  const handleToggleActive = useCallback(
    async (stage: StageTemplateItem) => {
      setBusyId(stage.id);
      try {
        const res = await fetch(`/api/v1/settings/stages/${stage.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !stage.isActive }),
        });
        if (!res.ok) {
          const errMsg = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errMsg.error ?? "تعذّر تغيير الحالة.");
        }
        const updated = (await res.json()) as { data: StageTemplateItem };
        setStages((prev) =>
          prev.map((row) => (row.id === stage.id ? updated.data : row)),
        );
        toast(stage.isActive ? "تم تعطيل المرحلة" : "تم تفعيل المرحلة", "success");
        refresh();
      } catch (err) {
        toast(err instanceof Error ? `تعذّر التحديث: ${err.message}` : `تعذّر التحديث`, "error");
      } finally {
        setBusyId(null);
      }
    },
    [refresh, toast],
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder),
    [stages],
  );

  return (
    <>
      <PageHeader
        caption="الإعدادات"
        title="مراحل المشاريع"
        description="رتّب وعدّل قوالب المراحل التي ينطلق منها كل مشروع جديد. يمكنك تعطيل مرحلة في أي وقت دون حذف بياناتها."
        actions={
          <button
            type="button"
            className="button-primary"
            onClick={() => setShowCreate((v) => !v)}
            disabled={isPending}
          >
            {showCreate ? "إخفاء النموذج" : "إضافة مرحلة"}
          </button>
        }
      />

      {showCreate ? (
        <section className="panel space-y-4 py-6">
          <div>
            <h2 className="text-xl font-semibold">إضافة مرحلة جديدة</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              يُولَّد المعرّف (slug) تلقائياً من الاسم وتُضاف المرحلة في نهاية الترتيب.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="block font-medium">الاسم<span className="text-[var(--accent)]"> *</span></span>
              <input
                className="input-field mt-1.5 w-full"
                value={createDraft.name}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="تصميم وعرض سعر"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="block font-medium">الأيام المتوقعة</span>
              <input
                className="input-field mt-1.5 w-full"
                type="number"
                min={0}
                value={createDraft.expectedDays}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, expectedDays: e.target.value }))
                }
                placeholder="مثلاً ٣"
              />
            </label>
            <label className="block text-sm">
              <span className="block font-medium">الدور المسؤول</span>
              <select
                className="input-field mt-1.5 w-full"
                value={createDraft.ownerRole}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, ownerRole: e.target.value }))
                }
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-3 self-end pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createDraft.isOptional}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, isOptional: e.target.checked }))
                  }
                />
                <span>اختيارية (يمكن تخطيها)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createDraft.requiresDepositAttestation}
                  onChange={(e) =>
                    setCreateDraft((d) => ({
                      ...d,
                      requiresDepositAttestation: e.target.checked,
                    }))
                  }
                />
                <span>يتطلب تأكيد عربون قبل البدء</span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="button-primary"
              onClick={handleCreate}
              disabled={busyId === "__new__"}
            >
              {busyId === "__new__" ? "جاري الإنشاء…" : "حفظ المرحلة"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setShowCreate(false);
                setCreateDraft(EMPTY_CREATE_DRAFT);
              }}
            >
              إلغاء
            </button>
          </div>
        </section>
      ) : null}

      {sortedStages.length === 0 ? (
        <EmptyState
          heading="لا توجد قوالب مراحل بعد"
          description="أضف أول مرحلة لتبدأ في إنشاء مشاريع تتبعها."
          action={
            <button
              className="button-primary"
              onClick={() => setShowCreate(true)}
              type="button"
            >
              إضافة مرحلة
            </button>
          }
        />
      ) : (
        <section className="panel py-6">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="text-[var(--muted-foreground)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-3 pe-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">الاسم</th>
                  <th className="px-3 py-3 font-medium">المعرّف</th>
                  <th className="px-3 py-3 font-medium">الدور</th>
                  <th className="px-3 py-3 font-medium">الأيام</th>
                  <th className="px-3 py-3 font-medium">عربون</th>
                  <th className="px-3 py-3 font-medium">اختيارية</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {sortedStages.map((stage, idx) => {
                  const isEditing = editingId === stage.id;
                  const draft = isEditing ? editDraft : null;
                  return (
                    <tr
                      key={stage.id}
                      className="border-b border-[var(--border)] last:border-b-0 align-top"
                    >
                      <td className="py-4 pe-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium tabular-nums">
                            {stage.sortOrder + 1}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="button-secondary px-2 py-1 text-xs"
                              onClick={() => handleMove(stage.id, "up")}
                              disabled={idx === 0 || busyId === stage.id}
                              aria-label="نقل للأعلى"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="button-secondary px-2 py-1 text-xs"
                              onClick={() => handleMove(stage.id, "down")}
                              disabled={
                                idx === sortedStages.length - 1 ||
                                busyId === stage.id
                              }
                              aria-label="نقل للأسفل"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {isEditing && draft ? (
                          <input
                            className="input-field w-full"
                            value={draft.name}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, name: e.target.value } : d,
                              )
                            }
                          />
                        ) : (
                          <span className="font-medium">{stage.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-[var(--muted-foreground)] tabular-nums">
                        <code className="text-xs">{stage.slug}</code>
                      </td>
                      <td className="px-3 py-4">
                        {isEditing && draft ? (
                          <select
                            className="input-field w-full"
                            value={draft.ownerRole}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, ownerRole: e.target.value } : d,
                              )
                            }
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : stage.ownerRole ? (
                          INTERNAL_USER_ROLE_LABELS[
                            stage.ownerRole as keyof typeof INTERNAL_USER_ROLE_LABELS
                          ] ?? stage.ownerRole
                        ) : (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 tabular-nums">
                        {isEditing && draft ? (
                          <input
                            className="input-field w-20"
                            type="number"
                            min={0}
                            value={draft.expectedDays}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d
                                  ? { ...d, expectedDays: e.target.value }
                                  : d,
                              )
                            }
                          />
                        ) : stage.expectedDays != null ? (
                          stage.expectedDays
                        ) : (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {stage.requiresDepositAttestation ? "مطلوب" : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {isEditing && draft ? (
                          <input
                            type="checkbox"
                            checked={draft.isOptional}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d
                                  ? { ...d, isOptional: e.target.checked }
                                  : d,
                              )
                            }
                          />
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {stage.isOptional ? "نعم" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        {isEditing && draft ? (
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={draft.isActive}
                              onChange={(e) =>
                                setEditDraft((d) =>
                                  d
                                    ? { ...d, isActive: e.target.checked }
                                    : d,
                                )
                              }
                            />
                            <span>نشطة</span>
                          </label>
                        ) : (
                          <span
                            className={
                              stage.isActive
                                ? "rounded-full bg-[var(--tone-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--tone-active-fg)]"
                                : "rounded-full bg-[var(--panel-strong)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted-foreground)]"
                            }
                          >
                            {stage.isActive ? "نشطة" : "معطّلة"}
                          </span>
                        )}
                        {stage.activeInstanceCount > 0 && (
                          <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">
                            {stage.activeInstanceCount} مشروع نشط
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="button-primary px-3 py-1 text-xs"
                                onClick={() => handleSaveEdit(stage.id)}
                                disabled={busyId === stage.id}
                              >
                                حفظ
                              </button>
                              <button
                                type="button"
                                className="button-secondary px-3 py-1 text-xs"
                                onClick={handleCancelEdit}
                              >
                                إلغاء
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="button-secondary px-3 py-1 text-xs"
                                onClick={() => handleStartEdit(stage)}
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                className="button-secondary px-3 py-1 text-xs"
                                onClick={() => handleToggleActive(stage)}
                                disabled={
                                  busyId === stage.id ||
                                  (stage.isActive && stage.activeInstanceCount > 0
                                    ? false
                                    : false)
                                }
                                title={
                                  stage.isActive && stage.activeInstanceCount > 0
                                    ? "يوجد مشاريع نشطة تستخدم هذه المرحلة — التعطيل لن يحذفها"
                                    : undefined
                                }
                              >
                                {stage.isActive ? "تعطيل" : "تفعيل"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[var(--muted-foreground)]">
            ملاحظة: لا يمكن حذف مرحلة بها مشاريع نشطة. عطّلها بدلاً من ذلك.
          </p>
        </section>
      )}
    </>
  );
}
