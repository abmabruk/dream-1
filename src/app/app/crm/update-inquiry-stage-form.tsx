"use client";

import { useActionState } from "react";

import {
  INQUIRY_STAGE_LABELS,
  INQUIRY_STAGE_VALUES,
  type InquiryStage,
} from "@/modules/crm/inquiry-stage";

import { initialInquiryActionState, updateInquiryStageAction } from "./actions";

type Props = {
  inquiryId: string;
  currentStage: InquiryStage;
  nextFollowUpAt: string | null;
};

export function UpdateInquiryStageForm({
  inquiryId,
  currentStage,
  nextFollowUpAt,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateInquiryStageAction,
    initialInquiryActionState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="inquiryId" type="hidden" value={inquiryId} />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`stage-${inquiryId}`}>
          Stage
        </label>
        <select
          className="input-field"
          defaultValue={currentStage}
          id={`stage-${inquiryId}`}
          name="stage"
        >
          {INQUIRY_STAGE_VALUES.map((stage) => (
            <option key={stage} value={stage}>
              {INQUIRY_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`followup-${inquiryId}`}>
          Next follow-up
        </label>
        <input
          className="input-field"
          defaultValue={nextFollowUpAt ? nextFollowUpAt.slice(0, 10) : ""}
          id={`followup-${inquiryId}`}
          name="nextFollowUpAt"
          type="date"
        />
      </div>

      <textarea
        className="input-field min-h-24"
        name="notes"
        placeholder="Stage update note"
      />

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

      <button className="button-secondary w-full disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Updating..." : "Update inquiry"}
      </button>
    </form>
  );
}
