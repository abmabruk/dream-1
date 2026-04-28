"use client";

import { useActionState, useEffect, useRef } from "react";

import { useToast } from "@/components/ui";

import { createCustomerAction } from "./actions";
import { initialCustomerActionState } from "./state";
export function CreateCustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    initialCustomerActionState
  );
  const { toast } = useToast();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && state.error === null) {
      toast("✓ تم إنشاء العميل", "success");
    }
    wasPendingRef.current = pending;
  }, [pending, state, toast]);

  return (
    <form action={formAction} className="panel space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          عميل جديد
        </p>
        <h2 className="mt-2 text-2xl font-semibold">إنشاء عميل</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">
            الاسم<span className="field-required" aria-hidden>*</span>
          </label>
          <input className="input-field" id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="phone">
            الهاتف
          </label>
          <input className="input-field" id="phone" name="phone" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            البريد الإلكتروني
          </label>
          <input className="input-field" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="city">
            المدينة
          </label>
          <input className="input-field" id="city" name="city" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="district">
            الحي
          </label>
          <input className="input-field" id="district" name="district" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="notes">
            ملاحظات
          </label>
          <textarea className="input-field min-h-28" id="notes" name="notes" />
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
          disabled={pending}
          type="submit"
        >
          {pending ? "جاري الحفظ..." : "إنشاء عميل"}
        </button>
      </div>
    </form>
  );
}
