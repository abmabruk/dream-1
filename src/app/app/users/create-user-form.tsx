"use client";

import { useActionState } from "react";

import type { InternalUserRole } from "@/modules/users/user-access";
import { INTERNAL_USER_ROLE_LABELS } from "@/modules/users/user-access";

import { createUserAction } from "./actions";
import { initialUserAdminActionState } from "./state";
export function CreateUserForm({
  availableRoles,
}: {
  availableRoles: InternalUserRole[];
}) {
  const [state, formAction, pending] = useActionState(
    createUserAction,
    initialUserAdminActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          عضو فريق جديد
        </p>
        <h2 className="mt-2 text-2xl font-semibold">إنشاء مستخدم</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          سيُنشئ هذا حساب دخول حقيقي بكلمة مرور نشطة فوراً.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="firstName">
            الاسم الأول
          </label>
          <input className="input-field" id="firstName" name="firstName" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="lastName">
            اسم العائلة
          </label>
          <input className="input-field" id="lastName" name="lastName" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="email">
            البريد الإلكتروني
          </label>
          <input className="input-field" id="email" name="email" required type="email" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="phone">
            الهاتف
          </label>
          <input className="input-field" id="phone" name="phone" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="role">
            الدور
          </label>
          <select className="input-field" defaultValue={availableRoles[0]} id="role" name="role">
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {INTERNAL_USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="password">
            كلمة المرور المؤقتة
          </label>
          <input
            className="input-field"
            id="password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <button className="button-primary disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "جاري الإنشاء..." : "إنشاء مستخدم"}
      </button>
    </form>
  );
}
