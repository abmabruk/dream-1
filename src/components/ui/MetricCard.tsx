import { forwardRef, type ReactNode } from "react";

export interface MetricCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children" | "value"> {
  label: string;
  value: ReactNode;
  /** Optional small line under the number — e.g. "+12% هذا الأسبوع". */
  sublabel?: ReactNode;
  /** Trend hint colors the sublabel. */
  trend?: "up" | "down" | "flat";
  /** Tone tints the big number. */
  tone?: "default" | "accent" | "warn" | "danger" | "muted";
  /** Optional leading icon slot (any node). */
  icon?: ReactNode;
  /**
   * Visual hierarchy variant.
   * - `hero` — biggest number, generous padding, used for the dashboard
   *   primary metric (issue #1).
   * - `default` — standard panel (back-compat).
   * - `compact` — tertiary counts in a horizontal strip; smaller number,
   *   tighter padding.
   */
  size?: "hero" | "default" | "compact";
}

const TONE_COLOR: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "var(--foreground)",
  accent: "var(--accent)",
  warn: "var(--tone-waiting-fg)",
  danger: "var(--tone-blocked-fg)",
  muted: "var(--muted-foreground)",
};

const TREND_COLOR: Record<NonNullable<MetricCardProps["trend"]>, string> = {
  up: "var(--tone-done-fg)",
  down: "var(--tone-blocked-fg)",
  flat: "var(--muted-foreground)",
};

export const MetricCard = forwardRef<HTMLButtonElement, MetricCardProps>(
  function MetricCard(
    {
      label,
      value,
      sublabel,
      trend,
      tone = "default",
      icon,
      size = "default",
      onClick,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    const interactive = Boolean(onClick);
    const Component: "button" | "div" = interactive ? "button" : ("div" as const);

    const sizeMap = {
      hero: {
        wrap: "p-7 md:p-8",
        label: "text-sm uppercase tracking-[0.2em] text-[var(--muted-foreground)]",
        number: "mt-4 text-5xl md:text-6xl font-semibold tracking-tight tabular-nums leading-none",
        sublabel: "mt-3 text-sm",
      },
      default: {
        wrap: "",
        label: "text-sm text-[var(--muted-foreground)]",
        number: "mt-3 text-4xl font-semibold tracking-tight tabular-nums",
        sublabel: "mt-2 text-xs",
      },
      compact: {
        wrap: "p-3 md:p-4 rounded-2xl",
        label: "text-[0.7rem] uppercase tracking-[0.16em] text-[var(--muted-foreground)]",
        number: "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
        sublabel: "mt-1 text-[0.7rem]",
      },
    } as const;

    const sz = sizeMap[size];

    const content = (
      <>
        <div className="flex items-start justify-between gap-3">
          <p className={sz.label}>{label}</p>
          {icon ? <span className="shrink-0 text-[var(--muted-foreground)]">{icon}</span> : null}
        </div>
        <div
          className={sz.number}
          style={{ color: TONE_COLOR[tone] }}
        >
          {value}
        </div>
        {sublabel ? (
          <p
            className={sz.sublabel}
            style={{ color: trend ? TREND_COLOR[trend] : "var(--muted-foreground)" }}
          >
            {sublabel}
          </p>
        ) : null}
      </>
    );

    const baseClass =
      `panel block w-full text-start transition-shadow duration-200 ease-out ${sz.wrap}`;
    const hoverClass = interactive
      ? "hover:shadow-[0_22px_60px_rgba(64,48,27,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
      : "";

    if (Component === "button") {
      return (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className={`${baseClass} ${hoverClass} ${className}`}
          style={style}
          {...rest}
        >
          {content}
        </button>
      );
    }

    return (
      <div className={`${baseClass} ${className}`} style={style}>
        {content}
      </div>
    );
  },
);
