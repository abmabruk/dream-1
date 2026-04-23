"use client";

import { useActionState } from "react";

import {
  initialUserAdminActionState,
  resetUserPasswordAction,
} from "./actions";

export function ResetUserPasswordForm({
  userId,
}: {
  userId: string;
}) {
  const [state, formAction, pending] = useActionState(
    resetUserPasswordAction,
    initialUserAdminActionState
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
      <input name="userId" type="hidden" value={userId} />

      <div>
        <p className="text-sm font-semibold">Admin password reset</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Set a new password for this account.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`password-${userId}`}>
          New password
        </label>
        <input
          className="input-field"
          id={`password-${userId}`}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>

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

      <button className="button-secondary disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
