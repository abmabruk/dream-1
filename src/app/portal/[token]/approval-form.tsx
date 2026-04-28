"use client";

import { useActionState } from "react";

import { approvePortalOrderAction } from "./actions";
import { initialPortalApprovalActionState } from "./state";
type Props = {
  token: string;
};

export function PortalApprovalForm({ token }: Props) {
  const [state, formAction, pending] = useActionState(
    approvePortalOrderAction,
    initialPortalApprovalActionState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="token" type="hidden" value={token} />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="note">
          ملاحظة الموافقة
        </label>
        <textarea
          className="input-field min-h-28"
          id="note"
          name="note"
          placeholder="ملاحظة اختيارية لفريق المصنع"
        />
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

      <button className="button-primary w-full disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "جارٍ الإرسال..." : "الموافقة على الطلب"}
      </button>
    </form>
  );
}
