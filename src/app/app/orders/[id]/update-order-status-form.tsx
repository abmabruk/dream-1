"use client";

import { useActionState } from "react";

import {
  initialOrderStatusActionState,
  updateOrderStatusAction,
} from "./actions";
import {
  ORDER_STATUS_LABELS,
  type OrderWorkflowStatus,
} from "@/modules/orders/order-status";

type Props = {
  orderId: string;
  currentStatus: OrderWorkflowStatus;
  allowedStatuses: OrderWorkflowStatus[];
};

export function UpdateOrderStatusForm({
  orderId,
  currentStatus,
  allowedStatuses,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateOrderStatusAction,
    initialOrderStatusActionState
  );

  if (allowedStatuses.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
        No further status transitions are available from{" "}
        <span className="font-medium text-[var(--foreground)]">
          {ORDER_STATUS_LABELS[currentStatus]}
        </span>
        .
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="orderId" type="hidden" value={orderId} />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="status">
          Next status
        </label>
        <select className="input-field" defaultValue={allowedStatuses[0]} id="status" name="status">
          {allowedStatuses.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="note">
          Change note
        </label>
        <textarea className="input-field min-h-28" id="note" name="note" />
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
        {pending ? "Updating..." : "Update status"}
      </button>
    </form>
  );
}
