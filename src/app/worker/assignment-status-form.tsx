"use client";

import { useActionState } from "react";

import {
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentWorkflowStatus,
} from "@/modules/production/assignment-status";

import { updateAssignmentStatusAction } from "./actions";
import { initialWorkerActionState } from "./state";
type Props = {
  assignmentId: string;
  currentStatus: AssignmentWorkflowStatus;
  allowedStatuses: AssignmentWorkflowStatus[];
};

export function AssignmentStatusForm({
  assignmentId,
  currentStatus,
  allowedStatuses,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateAssignmentStatusAction,
    initialWorkerActionState
  );

  if (allowedStatuses.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        لا تتوفر تغييرات حالة إضافية من{" "}
        <span className="font-medium text-[var(--foreground)]">
          {ASSIGNMENT_STATUS_LABELS[currentStatus]}
        </span>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input name="assignmentId" type="hidden" value={assignmentId} />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`status-${assignmentId}`}>
          الحالة التالية
        </label>
        <select
          className="input-field"
          defaultValue={allowedStatuses[0]}
          id={`status-${assignmentId}`}
          name="status"
        >
          {allowedStatuses.map((status) => (
            <option key={status} value={status}>
              {ASSIGNMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="input-field min-h-24"
        name="note"
        placeholder="أضف ملاحظة تحديث"
      />

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <button className="button-primary w-full disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "جاري التحديث..." : "تحديث الإسناد"}
      </button>
    </form>
  );
}
