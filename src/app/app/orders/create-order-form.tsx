"use client";

import { useActionState } from "react";

import type { CustomerListItem } from "@/modules/customers/customer.schemas";

import { createOrderAction, initialOrderActionState } from "./actions";

type Props = {
  customers: CustomerListItem[];
};

export function CreateOrderForm({ customers }: Props) {
  const [state, formAction, pending] = useActionState(
    createOrderAction,
    initialOrderActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          New order
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Create order</h2>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="customerId">
          Customer
        </label>
        <select className="input-field" defaultValue="" id="customerId" name="customerId" required>
          <option disabled value="">
            Select customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="title">
          Title
        </label>
        <input className="input-field" id="title" name="title" required />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="targetDate">
            Target date
          </label>
          <input className="input-field" id="targetDate" name="targetDate" type="date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="quotedAmount">
            Quoted amount
          </label>
          <input className="input-field" id="quotedAmount" min="0" name="quotedAmount" step="0.01" type="number" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <textarea className="input-field min-h-28" id="description" name="description" />
      </div>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        className="button-primary w-full disabled:opacity-60"
        disabled={pending || customers.length === 0}
        type="submit"
      >
        {pending ? "Saving..." : "Create order"}
      </button>

      {customers.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Create a customer first before creating the first order.
        </p>
      )}
    </form>
  );
}
