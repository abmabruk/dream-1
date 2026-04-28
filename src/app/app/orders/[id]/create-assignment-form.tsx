"use client";

import { useActionState } from "react";

import type { AssignableWorker } from "@/modules/users/user.schemas";

import { createAssignmentAction } from "./actions";
import { initialAssignmentActionState } from "./state";
type Props = {
  orderId: string;
  workers: AssignableWorker[];
};

export function CreateAssignmentForm({ orderId, workers }: Props) {
  const [state, formAction, pending] = useActionState(
    createAssignmentAction,
    initialAssignmentActionState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="orderId" type="hidden" value={orderId} />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="workerId">
          العامل
        </label>
        <select className="input-field" defaultValue="" id="workerId" name="workerId" required>
          <option disabled value="">
            اختر العامل
          </option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.displayName} ({worker.role})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="station">
          المحطة أو المهمة
        </label>
        <input
          className="input-field"
          id="station"
          name="station"
          placeholder="قطع، تجميع، تركيب، فحص..."
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="scheduledFor">
          التاريخ المجدول
        </label>
        <input className="input-field" id="scheduledFor" name="scheduledFor" type="date" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="notes">
          ملاحظات
        </label>
        <textarea className="input-field min-h-28" id="notes" name="notes" />
      </div>

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

      <button
        className="button-primary w-full disabled:opacity-60"
        disabled={pending || workers.length === 0}
        type="submit"
      >
        {pending ? "جاري الإسناد..." : "إنشاء إسناد"}
      </button>

      {workers.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          لا يوجد عمال يمكن إسنادهم في هذا المصنع.
        </p>
      )}
    </form>
  );
}
