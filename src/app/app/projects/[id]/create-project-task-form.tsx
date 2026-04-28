"use client";

import { useActionState } from "react";

import type { LocationItem, StageInstanceItem } from "@/modules/projects/project.schemas";

import { createProjectTaskAction } from "./actions";

const initialProjectDetailActionState = {
  error: null,
  message: null,
};

const STAGE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "لم تبدأ",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متوقفة",
  COMPLETED: "مكتملة",
  SKIPPED: "متجاوزة",
};

export function CreateProjectTaskForm({
  projectId,
  assignees,
  stageInstances = [],
  defaultStageInstanceId = null,
  locations = [],
}: {
  projectId: string;
  assignees: { id: string; displayName: string; role: string }[];
  stageInstances?: StageInstanceItem[];
  defaultStageInstanceId?: string | null;
  locations?: LocationItem[];
}) {
  const [state, formAction, pending] = useActionState(
    createProjectTaskAction,
    initialProjectDetailActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <input name="projectId" type="hidden" value={projectId} />

      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          مهمة جديدة
        </p>
        <h2 className="mt-2 text-2xl font-semibold">إضافة مهمة للمشروع</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="title">
            عنوان المهمة<span className="field-required" aria-hidden>*</span>
          </label>
          <input className="input-field" id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="priority">
            الأولوية
          </label>
          <select className="input-field" defaultValue="MEDIUM" id="priority" name="priority">
            <option value="LOW">منخفضة</option>
            <option value="MEDIUM">متوسطة</option>
            <option value="HIGH">عالية</option>
            <option value="URGENT">عاجلة</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="assignedToUserId">
            المُسند إليه
          </label>
          <select className="input-field" defaultValue="" id="assignedToUserId" name="assignedToUserId">
            <option value="">غير مُسند</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.displayName} · {assignee.role}
              </option>
            ))}
          </select>
        </div>
        {stageInstances.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="stageInstanceId">
              المرحلة
            </label>
            <select
              className="input-field"
              defaultValue={defaultStageInstanceId ?? ""}
              id="stageInstanceId"
              name="stageInstanceId"
            >
              <option value="">— بدون مرحلة —</option>
              {[...stageInstances]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {STAGE_STATUS_LABELS[s.status] ?? s.status}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        {locations.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="locationId">
              الموقع
            </label>
            <select
              className="input-field"
              defaultValue={[...locations].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? ""}
              id="locationId"
              name="locationId"
            >
              <option value="">— بدون موقع —</option>
              {[...locations]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code ? `${l.name} · ${l.code}` : l.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="dueDate">
            تاريخ الاستحقاق
          </label>
          <input className="input-field" id="dueDate" name="dueDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          الوصف
        </label>
        <textarea className="input-field min-h-24" id="description" name="description" />
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
        <input name="requiresApproval" type="checkbox" />
        يجب الموافقة على هذه المهمة قبل اعتبارها مكتملة.
      </label>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <div className="flex">
        <button
          className="button-primary w-full md:w-auto md:ms-auto"
          disabled={pending}
          type="submit"
        >
          {pending ? "جاري الإنشاء..." : "إنشاء مهمة"}
        </button>
      </div>
    </form>
  );
}
