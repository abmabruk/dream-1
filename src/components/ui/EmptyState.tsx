import { forwardRef, type ReactNode } from "react";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Icon slot — pass an inline SVG (preferred). When omitted, a generic
   *  inline SVG is rendered. */
  children?: ReactNode;
  heading: string;
  description?: string;
  /** Primary action — pass any node (typically a `<button class="button-primary">`). */
  action?: ReactNode;
  /** Visual variant. `compact` keeps padding tight for inline placement. */
  variant?: "default" | "compact";
}

/** Default illustration — a soft folder/box silhouette in cream + teal. */
function DefaultEmptyIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="14"
        y="26"
        width="68"
        height="50"
        rx="10"
        fill="var(--panel-strong)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path
        d="M14 36 L48 36 L52 28 L82 28"
        stroke="var(--accent)"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="48" cy="56" r="14" fill="var(--accent)" fillOpacity="0.10" />
      <path
        d="M42 56 L46 60 L54 52"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    { children, heading, description, action, variant = "default", className = "", style, ...rest },
    ref,
  ) {
    const padding = variant === "compact" ? "py-10" : "py-16";

    return (
      <div
        ref={ref}
        className={`panel flex flex-col items-center justify-center text-center gap-4 ${padding} px-6 ${className}`}
        style={style}
        {...rest}
      >
        <div className="text-[var(--muted-foreground)]">
          {children ?? <DefaultEmptyIllustration />}
        </div>
        <h3 className="text-xl font-semibold text-[var(--foreground)]">{heading}</h3>
        {description ? (
          <p className="max-w-md text-sm text-[var(--muted-foreground)] leading-relaxed">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    );
  },
);
