"use client";

import { useActionState } from "react";

import {
  createCustomerAction,
  initialCustomerActionState,
} from "./actions";

export function CreateCustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    initialCustomerActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          New customer
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Create customer</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input className="input-field" id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input className="input-field" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="phone">
            Phone
          </label>
          <input className="input-field" id="phone" name="phone" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="city">
            City
          </label>
          <input className="input-field" id="city" name="city" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="district">
            District
          </label>
          <input className="input-field" id="district" name="district" />
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

      <button className="button-primary disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving..." : "Create customer"}
      </button>
    </form>
  );
}
