"use client";

/**
 * ActivityTimeline — RTL-aware vertical timeline for `ProjectActivity`
 * entries (and any compatible shape). Type → tone mapping reuses the
 * unified status-tone palette.
 */

import { forwardRef } from "react";

import { toneVars, type Tone } from "@/lib/status-tone";
import { formatRelativeTime } from "@/lib/format";

export interface ActivityTimelineItem {
  id: string;
  type: string;
  message: string;
  actorName?: string | null;
  createdAt: string | Date;
  taskId?: string | null;
  stageInstanceId?: string | null;
}

export interface ActivityTimelineProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, "children"> {
  activities: ActivityTimelineItem[];
  /** When provided, items linked to a task become buttons triggering this. */
  onItemClick?: (item: ActivityTimelineItem) => void;
  emptyMessage?: string;
  /**
   * Wave 3 — when provided, only activities with this `stageInstanceId`
   * are rendered. Pass `undefined` / `"all"` to disable the filter,
   * or `"none"` to show only un-staged activities.
   */
  stageFilter?: string | "all" | "none";
}

/** Map every `ProjectActivityType` enum value to a unified tone. */
const ACTIVITY_TYPE_TONE: Record<string, Tone> = {
  PROJECT_CREATED: "planned",
  PROJECT_UPDATED: "planned",
  TASK_CREATED: "draft",
  TASK_UPDATED: "in-progress",
  TASK_ADDED_TO_TODAY: "planned",
  QUEUE_REORDERED: "planned",
  QUEUE_STATUS_CHANGED: "in-progress",
  TASK_APPROVED: "done",
  TASK_REJECTED: "blocked",
  COST_ADDED: "waiting",
  COST_DELETED: "cancelled",
  COMMENT_ADDED: "draft",
  ATTACHMENT_ADDED: "draft",
  ATTACHMENT_REMOVED: "cancelled",
  TASK_MENTION: "in-progress",
};

const ACTIVITY_TYPE_LABEL_AR: Record<string, string> = {
  PROJECT_CREATED: "إنشاء مشروع",
  PROJECT_UPDATED: "تحديث مشروع",
  TASK_CREATED: "مهمة جديدة",
  TASK_UPDATED: "تحديث مهمة",
  TASK_ADDED_TO_TODAY: "مضافة لليوم",
  QUEUE_REORDERED: "إعادة ترتيب",
  QUEUE_STATUS_CHANGED: "تغيير حالة",
  TASK_APPROVED: "موافقة",
  TASK_REJECTED: "رفض",
  COST_ADDED: "إضافة تكلفة",
  COST_DELETED: "حذف تكلفة",
  COMMENT_ADDED: "تعليق جديد",
  ATTACHMENT_ADDED: "مرفق جديد",
  ATTACHMENT_REMOVED: "حذف مرفق",
  TASK_MENTION: "إشارة في مهمة",
};

function formatAbsoluteAr(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const ActivityTimeline = forwardRef<HTMLOListElement, ActivityTimelineProps>(
  function ActivityTimeline(
    { activities, onItemClick, emptyMessage = "لا يوجد نشاط بعد.", className = "", stageFilter, ...rest },
    ref
  ) {
    const filtered =
      !stageFilter || stageFilter === "all"
        ? activities
        : stageFilter === "none"
          ? activities.filter((a) => !a.stageInstanceId)
          : activities.filter((a) => a.stageInstanceId === stageFilter);

    if (filtered.length === 0) {
      return (
        <p className="text-sm text-[var(--muted-foreground)]">{emptyMessage}</p>
      );
    }

    return (
      <ol
        ref={ref}
        className={`relative space-y-4 ${className}`}
        {...rest}
      >
        {/* Vertical rail — positioned at inline-start, RTL-safe via logical props. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2 bottom-2 w-px bg-[var(--border)]"
          style={{ insetInlineStart: "11px" }}
        />

        {filtered.map((activity) => {
          const tone = ACTIVITY_TYPE_TONE[activity.type] ?? "draft";
          const vars = toneVars(tone);
          const typeLabel =
            ACTIVITY_TYPE_LABEL_AR[activity.type] ??
            activity.type.replace(/_/g, " ").toLowerCase();
          const relative = formatRelativeTime(activity.createdAt);
          const absolute = formatAbsoluteAr(activity.createdAt);
          const linkable = Boolean(activity.taskId && onItemClick);

          return (
            <li key={activity.id} className="relative" style={{ paddingInlineStart: "32px" }}>
              {/* Dot */}
              <span
                aria-hidden="true"
                className="absolute top-2 inline-block size-3 rounded-full ring-4 ring-[var(--background)]"
                style={{
                  insetInlineStart: "5px",
                  background: vars.color,
                }}
              />

              <div
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 transition-colors"
                style={
                  linkable
                    ? { cursor: "pointer" }
                    : undefined
                }
                onClick={
                  linkable ? () => onItemClick?.(activity) : undefined
                }
                onKeyDown={
                  linkable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onItemClick?.(activity);
                        }
                      }
                    : undefined
                }
                role={linkable ? "button" : undefined}
                tabIndex={linkable ? 0 : undefined}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: vars.background,
                      color: vars.color,
                      border: `1px solid ${vars.borderColor}`,
                    }}
                  >
                    {typeLabel}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {activity.actorName || "النظام"}
                  </span>
                  <span
                    className="text-xs text-[var(--muted-foreground)] ms-auto"
                    title={absolute}
                  >
                    {relative}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                  {activity.message}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
);
