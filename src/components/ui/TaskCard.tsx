"use client";

import Link from "next/link";
import { forwardRef, type ReactNode } from "react";

import { PriorityDot } from "./PriorityDot";
import { StatusPill } from "./StatusPill";
import { type Priority } from "@/lib/status-tone";

export interface TaskCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "id" | "onClick" | "children"> {
  id: string;
  title: string;
  status: string;
  priority?: Priority;
  projectCode?: string | null;
  /** When provided, the projectCode renders as a link to /app/projects/{projectId}. */
  projectId?: string | null;
  dueDate?: Date | string | null;
  /** Used for stale-task highlighting. ISO string or Date. */
  lastActivityAt?: Date | string | null;
  assigneeName?: string | null;
  /** Wave 3 — when set, a small stage chip is rendered next to the project code. */
  stageName?: string | null;
  /** Wave 4 — when set, a small location chip is rendered next to the stage chip. */
  locationName?: string | null;

  onStart?: () => void;
  onDone?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onClick?: () => void;

  /** Optional slot rendered after the meta row — e.g. inline note input. */
  children?: ReactNode;
}

function staleLevel(lastActivityAt: Date | string | null | undefined): "none" | "soft" | "hard" {
  if (!lastActivityAt) return "none";
  const ts = typeof lastActivityAt === "string" ? new Date(lastActivityAt).getTime() : lastActivityAt.getTime();
  if (Number.isNaN(ts)) return "none";
  const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (days >= 7) return "hard";
  if (days >= 3) return "soft";
  return "none";
}

function formatDueDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  {
    id,
    title,
    status,
    priority,
    projectCode,
    projectId,
    dueDate,
    lastActivityAt,
    assigneeName,
    stageName,
    locationName,
    onStart,
    onDone,
    onApprove,
    onReject,
    onClick,
    className = "",
    style,
    children,
    ...rest
  },
  ref,
) {
  const stale = staleLevel(lastActivityAt);
  const dueText = formatDueDate(dueDate);
  const interactive = Boolean(onClick);

  const staleBorder =
    stale === "hard"
      ? "var(--tone-blocked-border)"
      : stale === "soft"
        ? "var(--tone-waiting-border)"
        : "var(--border)";
  // Issue #6: softer stale styling — 1px amber for 3+, 2px red for 7+ with a
  // gentle pulse to draw attention without screaming "error".
  const staleBorderWidth = stale === "hard" ? 2 : 1;

  return (
    <div
      ref={ref}
      data-task-id={id}
      data-stale={stale}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`group relative rounded-2xl border bg-[var(--panel)] backdrop-blur-md p-3 shadow-[0_1px_3px_rgba(64,48,27,0.05)] transition-all duration-150 ${stale === "hard" ? "ds-stale-hard" : ""} ${interactive ? "cursor-pointer hover:shadow-[0_8px_24px_rgba(64,48,27,0.10)] hover:-translate-y-px" : ""} ${className}`}
      style={{ borderColor: staleBorder, borderWidth: staleBorderWidth, ...style }}
      {...rest}
    >
      {stale !== "none" ? (
        <span
          aria-hidden
          className="absolute top-2 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[0.6rem] font-semibold leading-none"
          style={{
            insetInlineEnd: "0.5rem",
            background: stale === "hard" ? "var(--tone-blocked-bg)" : "var(--tone-waiting-bg)",
            color: stale === "hard" ? "var(--tone-blocked-fg)" : "var(--tone-waiting-fg)",
            border: `1px solid ${stale === "hard" ? "var(--tone-blocked-border)" : "var(--tone-waiting-border)"}`,
          }}
        >
          {stale === "hard" ? "⚠ متوقف ٧ أيام" : "⏱ ٣ أيام"}
        </span>
      ) : null}
      <div className="flex items-start gap-2">
        {priority ? <span className="mt-1.5"><PriorityDot priority={priority} /></span> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {projectCode ? (
              projectId ? (
                <Link
                  href={`/app/projects/${projectId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[0.65rem] font-bold text-[var(--accent)] tracking-wide hover:underline"
                  title="فتح صفحة المشروع"
                >
                  {projectCode}
                </Link>
              ) : (
                <span className="text-[0.65rem] font-bold text-[var(--accent)] tracking-wide">
                  {projectCode}
                </span>
              )
            ) : null}
            {stageName ? (
              <span
                className="rounded-full border px-2 py-[1px] text-[0.6rem] font-medium leading-none"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--muted-foreground)",
                  background: "var(--panel-strong)",
                }}
                title={`المرحلة: ${stageName}`}
              >
                مرحلة: {stageName}
              </span>
            ) : null}
            {locationName ? (
              <span
                className="rounded-full border px-2 py-[1px] text-[0.6rem] font-medium leading-none"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--muted-foreground)",
                  background: "var(--panel-strong)",
                }}
                title={`الموقع: ${locationName}`}
              >
                موقع: {locationName}
              </span>
            ) : null}
            <StatusPill status={status} size="sm" />
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-[var(--foreground)]">
            {title}
          </h3>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[0.7rem] text-[var(--muted-foreground)]">
            {assigneeName ? <span>{assigneeName}</span> : null}
            {assigneeName && dueText ? <span aria-hidden>·</span> : null}
            {dueText ? <span>{dueText}</span> : null}

          </div>
        </div>
      </div>

      {(onStart || onDone || onApprove || onReject) && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {onStart ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              className="rounded-md px-2.5 py-1 text-[0.7rem] font-semibold transition-colors"
              style={{
                background: "var(--tone-in-progress-bg)",
                color: "var(--tone-in-progress-fg)",
              }}
            >
              ابدأ
            </button>
          ) : null}
          {onDone ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDone(); }}
              className="rounded-md px-3 py-1 text-[0.7rem] font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              منجز
            </button>
          ) : null}
          {onApprove ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              className="rounded-md px-2.5 py-1 text-[0.7rem] font-semibold transition-colors"
              style={{
                background: "var(--tone-done-bg)",
                color: "var(--tone-done-fg)",
              }}
              aria-label="موافقة"
            >
              ✓ موافقة
            </button>
          ) : null}
          {onReject ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="rounded-md px-2.5 py-1 text-[0.7rem] font-semibold transition-colors"
              style={{
                background: "var(--tone-blocked-bg)",
                color: "var(--tone-blocked-fg)",
              }}
              aria-label="رفض"
            >
              ✕ رفض
            </button>
          ) : null}
        </div>
      )}

      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
});
