"use client";

import { useActionState } from "react";

import { signInAction } from "@/app/sign-in/actions";
import { initialSignInActionState as initialState } from "@/app/sign-in/state";

export function CustomerSignInForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {/* Always default to /portal/dashboard for customer login. */}
      <input type="hidden" name="redirect" value="/portal/dashboard" />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="customer-email">
          البريد الإلكتروني
        </label>
        <input
          className="input-field"
          id="customer-email"
          name="email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="customer-password">
          كلمة المرور
        </label>
        <input
          className="input-field"
          id="customer-password"
          name="password"
          type="password"
          placeholder="أدخل كلمة المرور"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        className="button-primary w-full disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}
