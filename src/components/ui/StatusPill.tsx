import { forwardRef } from "react";

import {
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  WORK_QUEUE_STATUS_LABELS,
} from "@/modules/projects/project-status";
import { statusToTone, TONE_LABELS_AR, toneVars, type Tone } from "@/lib/status-tone";

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  QUOTED: "بانتظار العرض",
  APPROVED: "مُعتمد",
  IN_PRODUCTION: "قيد الإنتاج",
  QUALITY_CHECK: "فحص الجودة",
  READY_FOR_DELIVERY: "جاهز للتسليم",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطط",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متوقف",
  DONE: "منجز",
};

const INQUIRY_STAGE_LABELS: Record<string, string> = {
  NEW: "جديد",
  CONTACTED: "تم التواصل",
  QUALIFIED: "مؤهل",
  QUOTED: "تم التسعير",
  WON: "تم الكسب",
  LOST: "خسر",
};

function defaultLabel(status: string): string {
  return (
    PROJECT_TASK_STATUS_LABELS[status as keyof typeof PROJECT_TASK_STATUS_LABELS] ??
    PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] ??
    WORK_QUEUE_STATUS_LABELS[status as keyof typeof WORK_QUEUE_STATUS_LABELS] ??
    ORDER_STATUS_LABELS[status] ??
    ASSIGNMENT_STATUS_LABELS[status] ??
    INQUIRY_STAGE_LABELS[status] ??
    TONE_LABELS_AR[statusToTone(status)]
  );
}

export interface StatusPillProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: string;
  /** Override the auto-resolved Arabic label. */
  label?: string;
  /** Explicit tone override. If absent, derived from `status`. */
  tone?: Tone;
  size?: "sm" | "md";
  /** Show a leading dot. Defaults to true. */
  dot?: boolean;
}

export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(
  function StatusPill(
    { status, label, tone, size = "md", dot = true, className = "", style, ...rest },
    ref,
  ) {
    const resolvedTone = tone ?? statusToTone(status);
    const text = label ?? defaultLabel(status);
    const sizeClasses =
      size === "sm" ? "text-[0.65rem] px-2 py-[2px]" : "text-xs px-2.5 py-1";

    const vars = toneVars(resolvedTone);

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold leading-none whitespace-nowrap ${sizeClasses} ${className}`}
        style={{
          background: vars.background,
          color: vars.color,
          borderColor: vars.borderColor,
          ...style,
        }}
        data-tone={resolvedTone}
        {...rest}
      >
        {dot ? (
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: vars.color }}
          />
        ) : null}
        {text}
      </span>
    );
  },
);
