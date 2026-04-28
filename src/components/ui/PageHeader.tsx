import { forwardRef, type ReactNode } from "react";

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  caption?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Action buttons / links rendered at the inline-end. */
  actions?: ReactNode;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(
  function PageHeader(
    { caption, title, description, actions, className = "", style, ...rest },
    ref,
  ) {
    return (
      <section
        ref={ref}
        className={`panel ${className}`}
        style={style}
        {...rest}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {caption ? (
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                {caption}
              </p>
            ) : null}
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-3xl text-sm md:text-base leading-7 md:leading-8 text-[var(--muted-foreground)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
          ) : null}
        </div>
      </section>
    );
  },
);
