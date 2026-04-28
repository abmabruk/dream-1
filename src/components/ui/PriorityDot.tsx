import { forwardRef } from "react";

import {
  PRIORITY_LABELS_AR,
  priorityColor,
  type Priority,
} from "@/lib/status-tone";

export interface PriorityDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  priority: Priority;
  size?: "sm" | "md" | "lg";
  /** Show the Arabic label inline next to the dot. */
  showLabel?: boolean;
}

const SIZES: Record<NonNullable<PriorityDotProps["size"]>, string> = {
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
};

export const PriorityDot = forwardRef<HTMLSpanElement, PriorityDotProps>(
  function PriorityDot(
    { priority, size = "md", showLabel = false, className = "", style, ...rest },
    ref,
  ) {
    const color = priorityColor(priority);
    const label = PRIORITY_LABELS_AR[priority];
    const isUrgent = priority === "URGENT";

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 ${className}`}
        title={label}
        aria-label={`${label}`}
        style={style}
        {...rest}
      >
        <span
          aria-hidden
          className={`inline-block rounded-full ${SIZES[size]}`}
          style={{
            background: color,
            boxShadow: isUrgent ? `0 0 0 0 ${color}` : undefined,
            animation: isUrgent ? "ds-pulse 1.4s ease-in-out infinite" : undefined,
          }}
        />
        {showLabel ? (
          <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        ) : null}
      </span>
    );
  },
);
