"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { signInAction } from "./actions";
import { initialSignInActionState as initialState } from "./state";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const searchParams = useSearchParams();
  const redirectParam = searchParams?.get("redirect") ?? "";

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {redirectParam ? (
        <input type="hidden" name="redirect" value={redirectParam} />
      ) : null}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          البريد الإلكتروني
        </label>
        <input
          className="input-field"
          id="email"
          name="email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          كلمة المرور
        </label>
        <input
          className="input-field"
          id="password"
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

      <button className="button-primary w-full disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}
