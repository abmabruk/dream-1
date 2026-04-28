"use client";

import { forwardRef } from "react";

import { PriorityDot } from "./PriorityDot";
import { StatusPill } from "./StatusPill";
import { type Priority } from "@/lib/status-tone";

export interface ProjectCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  code: string;
  name: string;
  status: string;
  priority?: Priority;
  ownerName?: string | null;
  dueDate?: Date | string | null;
  /** 0 to 100. */
  progress?: number;
  openTaskCount?: number;
  onClick?: () => void;
}

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(
  function ProjectCard(
    {
      code,
      name,
      status,
      priority,
      ownerName,
      dueDate,
      progress,
      openTaskCount,
      onClick,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    const interactive = Boolean(onClick);
    const dueText = formatDate(dueDate);
    const pct = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

    return (
      <div
        ref={ref}
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
        className={`panel transition-all duration-150 ${interactive ? "cursor-pointer hover:shadow-[0_22px_60px_rgba(64,48,27,0.12)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" : ""} ${className}`}
        style={style}
        {...rest}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[var(--accent)] tracking-wider">
                {code}
              </span>
              <StatusPill status={status} size="sm" />
              {priority ? <PriorityDot priority={priority} /> : null}
            </div>
            <h3 className="mt-2 text-base font-semibold leading-snug text-[var(--foreground)]">
              {name}
            </h3>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-[var(--muted-foreground)]">
          {ownerName ? <span>{ownerName}</span> : null}
          {ownerName && dueText ? <span aria-hidden>·</span> : null}
          {dueText ? <span>تستحق {dueText}</span> : null}
          {typeof openTaskCount === "number" ? (
            <span className="ms-auto font-semibold text-[var(--foreground)]">
              {openTaskCount} مهام مفتوحة
            </span>
          ) : null}
        </div>

        {pct !== null ? (
          <div className="mt-3">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--border)" }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: "var(--accent)" }}
              />
            </div>
            <p className="mt-1 text-[0.65rem] tabular-nums text-[var(--muted-foreground)]">
              {pct}%
            </p>
          </div>
        ) : null}
      </div>
    );
  },
);
