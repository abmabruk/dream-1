"use client";

import { useActionState } from "react";

import {
  createPortalAccessAction,
  initialPortalAccessActionState,
} from "./actions";

type Props = {
  orderId: string;
};

export function CreatePortalAccessForm({ orderId }: Props) {
  const [state, formAction, pending] = useActionState(
    createPortalAccessAction,
    initialPortalAccessActionState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="orderId" type="hidden" value={orderId} />

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
        {pending ? "Preparing link..." : "Create customer portal link"}
      </button>
    </form>
  );
}
