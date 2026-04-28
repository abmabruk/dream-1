"use client";

import { useActionState, useEffect, useRef } from "react";

import { useToast } from "@/components/ui";
import type { CustomerListItem } from "@/modules/customers/customer.schemas";

import { createOrderAction } from "./actions";
import { initialOrderActionState } from "./state";
type Props = {
  customers: CustomerListItem[];
};

export function CreateOrderForm({ customers }: Props) {
  const [state, formAction, pending] = useActionState(
    createOrderAction,
    initialOrderActionState
  );
  const { toast } = useToast();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && state.error === null) {
      toast("✓ تم إنشاء الطلب", "success");
    }
    wasPendingRef.current = pending;
  }, [pending, state, toast]);

  return (
    <form action={formAction} className="panel space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          طلب جديد
        </p>
        <h2 className="mt-2 text-2xl font-semibold">إنشاء طلب</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="customerId">
            العميل<span className="field-required" aria-hidden>*</span>
          </label>
          <select className="input-field" defaultValue="" id="customerId" name="customerId" required>
            <option disabled value="">
              اختر العميل
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="title">
            العنوان<span className="field-required" aria-hidden>*</span>
          </label>
          <input className="input-field" id="title" name="title" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="targetDate">
            تاريخ الاستهداف
          </label>
          <input className="input-field" id="targetDate" name="targetDate" type="date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="quotedAmount">
            المبلغ المعروض
          </label>
          <input className="input-field" id="quotedAmount" min="0" name="quotedAmount" step="0.01" type="number" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="description">
            الوصف
          </label>
          <textarea className="input-field min-h-28" id="description" name="description" />
        </div>
      </div>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex">
        <button
          className="button-primary w-full md:w-auto md:ms-auto"
          disabled={pending || customers.length === 0}
          type="submit"
        >
          {pending ? "جاري الحفظ..." : "إنشاء طلب"}
        </button>
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          أنشئ عميلاً أولاً قبل إنشاء الطلب الأول.
        </p>
      )}
    </form>
  );
}
