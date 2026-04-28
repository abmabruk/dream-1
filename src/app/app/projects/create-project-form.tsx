"use client";

import { useActionState } from "react";

import { createProjectAction } from "./actions";

const initialProjectActionState = {
  error: null,
  message: null,
};

export function CreateProjectForm({
  orders,
  owners,
}: {
  orders: { id: string; code: string; title: string }[];
  owners: { id: string; displayName: string; role: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialProjectActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          مشروع جديد
        </p>
        <h2 className="mt-2 text-2xl font-semibold">إنشاء مشروع داخلي</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          أبقِ المشاريع خفيفة. ستقود قائمة الانتظار اليومية التنفيذ الفعلي.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="name">
            اسم المشروع<span className="field-required" aria-hidden>*</span>
          </label>
          <input className="input-field" id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="priority">
            الأولوية
          </label>
          <select className="input-field" defaultValue="MEDIUM" id="priority" name="priority">
            <option value="LOW">منخفضة</option>
            <option value="MEDIUM">متوسطة</option>
            <option value="HIGH">عالية</option>
            <option value="URGENT">عاجلة</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ownerUserId">
            مالك المشروع
          </label>
          <select className="input-field" defaultValue="" id="ownerUserId" name="ownerUserId">
            <option value="">بدون مالك بعد</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName} · {owner.role}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="startDate">
            تاريخ البدء
          </label>
          <input className="input-field" id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="dueDate">
            تاريخ الاستحقاق
          </label>
          <input className="input-field" id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="orderId">
            الطلب المرتبط
          </label>
          <select className="input-field" defaultValue="" id="orderId" name="orderId">
            <option value="">غير مرتبط بطلب</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.code} · {order.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          الوصف
        </label>
        <textarea className="input-field min-h-24" id="description" name="description" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="notes">
          ملاحظات
        </label>
        <textarea className="input-field min-h-24" id="notes" name="notes" />
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

      <div className="flex">
        <button
          className="button-primary w-full md:w-auto md:ms-auto"
          disabled={pending}
          type="submit"
        >
          {pending ? "جاري الإنشاء..." : "إنشاء مشروع"}
        </button>
      </div>
    </form>
  );
}
