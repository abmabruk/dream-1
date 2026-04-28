"use client";

import { useActionState } from "react";

import {
  clockInAction,
  clockOutAction,
} from "./actions";
import { initialWorkerActionState } from "./state";
type Props = {
  mode: "in" | "out";
};

export function AttendanceForm({ mode }: Props) {
  const action = mode === "in" ? clockInAction : clockOutAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialWorkerActionState
  );

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        className="input-field min-h-24"
        name="note"
        placeholder={mode === "in" ? "ملاحظة اختيارية عند الحضور" : "ملاحظة اختيارية عند الانصراف"}
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
        {pending
          ? mode === "in"
            ? "جاري تسجيل الحضور..."
            : "جاري تسجيل الانصراف..."
          : mode === "in"
            ? "تسجيل الحضور"
            : "تسجيل الانصراف"}
      </button>
    </form>
  );
}
