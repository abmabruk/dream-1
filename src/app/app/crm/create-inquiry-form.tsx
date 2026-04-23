"use client";

import { useActionState } from "react";

import {
  INQUIRY_SOURCE_LABELS,
  INQUIRY_SOURCE_VALUES,
} from "@/modules/crm/inquiry-stage";
import type { UserListItem } from "@/modules/users/user.schemas";

import { createInquiryAction, initialInquiryActionState } from "./actions";

type Props = {
  assignees: UserListItem[];
};

export function CreateInquiryForm({ assignees }: Props) {
  const [state, formAction, pending] = useActionState(
    createInquiryAction,
    initialInquiryActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          New inquiry
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Capture lead</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input className="input-field" id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="phone">
            Phone
          </label>
          <input className="input-field" id="phone" name="phone" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input className="input-field" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="source">
            Source
          </label>
          <select className="input-field" defaultValue="OTHER" id="source" name="source">
            {INQUIRY_SOURCE_VALUES.map((source) => (
              <option key={source} value={source}>
                {INQUIRY_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="assignedToId">
            Assign to
          </label>
          <select className="input-field" defaultValue="" id="assignedToId" name="assignedToId">
            <option value="">Unassigned</option>
            {assignees.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.role})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="interest">
            Interest
          </label>
          <input className="input-field" id="interest" name="interest" placeholder="Kitchen, wardrobe, office..." />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="budgetAmount">
            Budget amount
          </label>
          <input className="input-field" id="budgetAmount" min="0" name="budgetAmount" step="0.01" type="number" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="nextFollowUpAt">
            Next follow-up
          </label>
          <input className="input-field" id="nextFollowUpAt" name="nextFollowUpAt" type="date" />
        </div>
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

      <button className="button-primary w-full disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving..." : "Create inquiry"}
      </button>
    </form>
  );
}
