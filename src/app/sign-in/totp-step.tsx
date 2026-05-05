"use client";

import { useActionState } from "react";

import { totp2faCancelAction, totp2faVerifyAction } from "./actions";
import {
  initialTotp2faActionState as initialState,
  type Totp2faActionState,
} from "./state";

export function TotpStep({ redirectTo }: { redirectTo?: string | null }) {
  const [state, formAction, pending] = useActionState<
    Totp2faActionState,
    FormData
  >(totp2faVerifyAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {redirectTo ? (
        <input type="hidden" name="redirect" value={redirectTo} />
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm leading-7 text-[var(--muted-foreground)]">
        افتح تطبيق المصادقة (Google Authenticator, 1Password, Authy …) وأدخل
        الرمز المكوَّن من ٦ أرقام. يمكنك أيضاً استخدام أحد رموز الاسترداد إذا
        فقدت الجهاز.
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="code">
          رمز التحقق
        </label>
        <input
          className="input-field tracking-[0.4em] text-center font-mono"
          id="code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          placeholder="••••••"
          required
          autoFocus
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
        {pending ? "جاري التحقق..." : "تأكيد ودخول"}
      </button>

      <button
        className="block w-full text-center text-sm text-[var(--muted-foreground)] hover:underline"
        formAction={totp2faCancelAction}
        type="submit"
      >
        إلغاء والعودة لتسجيل الدخول
      </button>
    </form>
  );
}
