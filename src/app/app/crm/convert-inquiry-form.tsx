"use client";

import { useActionState, useState } from "react";

import { convertInquiryAction } from "./actions";
import { initialInquiryActionState } from "./state";

type Props = {
  inquiryId: string;
  inquiryName: string;
  defaultEmail: string | null;
  defaultPhone: string;
  defaultInterest: string | null;
  alreadyConverted: boolean;
};

export function ConvertInquiryForm({
  inquiryId,
  inquiryName,
  defaultEmail,
  defaultPhone,
  defaultInterest,
  alreadyConverted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    convertInquiryAction,
    initialInquiryActionState
  );

  if (alreadyConverted) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
        تم تحويل هذا الاستفسار إلى عميل وطلب.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        className="button-primary w-full"
        onClick={() => setOpen(true)}
        type="button"
      >
        تحويل لعميل
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <input name="inquiryId" type="hidden" value={inquiryId} />

      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          تحويل لعميل وطلب
        </p>
        <h3 className="mt-1 text-lg font-semibold">{inquiryName}</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`ce-${inquiryId}`}>
            بريد العميل
          </label>
          <input
            className="input-field"
            defaultValue={defaultEmail ?? ""}
            id={`ce-${inquiryId}`}
            name="customerEmail"
            type="email"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`cp-${inquiryId}`}>
            هاتف العميل
          </label>
          <input
            className="input-field"
            defaultValue={defaultPhone}
            id={`cp-${inquiryId}`}
            name="customerPhone"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`cc-${inquiryId}`}>
            المدينة
          </label>
          <input
            className="input-field"
            id={`cc-${inquiryId}`}
            name="customerCity"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`cd-${inquiryId}`}>
            الحي
          </label>
          <input
            className="input-field"
            id={`cd-${inquiryId}`}
            name="customerDistrict"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`ot-${inquiryId}`}>
          عنوان الطلب
        </label>
        <input
          className="input-field"
          defaultValue={defaultInterest ?? ""}
          id={`ot-${inquiryId}`}
          name="orderTitle"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`od-${inquiryId}`}>
          وصف الطلب
        </label>
        <textarea
          className="input-field min-h-20"
          id={`od-${inquiryId}`}
          name="orderDescription"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`otd-${inquiryId}`}>
          التاريخ المستهدف
        </label>
        <input
          className="input-field"
          id={`otd-${inquiryId}`}
          name="orderTargetDate"
          type="date"
        />
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

      <div className="flex gap-2">
        <button
          className="button-primary flex-1 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "جاري التحويل..." : "تأكيد التحويل"}
        </button>
        <button
          className="button-secondary"
          onClick={() => setOpen(false)}
          type="button"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
