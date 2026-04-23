"use client";

import { useActionState } from "react";

import type { AssignableWorker } from "@/modules/users/user.schemas";

import {
  createAssignmentAction,
  initialAssignmentActionState,
} from "./actions";

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
          Worker
        </label>
        <select className="input-field" defaultValue="" id="workerId" name="workerId" required>
          <option disabled value="">
            Select worker
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
          Station or task
        </label>
        <input
          className="input-field"
          id="station"
          name="station"
          placeholder="Cutting, assembly, fitting, inspection..."
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="scheduledFor">
          Scheduled date
        </label>
        <input className="input-field" id="scheduledFor" name="scheduledFor" type="date" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="notes">
          Notes
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
        {pending ? "Assigning..." : "Create assignment"}
      </button>

      {workers.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          No assignable workers found in this factory.
        </p>
      )}
    </form>
  );
}
