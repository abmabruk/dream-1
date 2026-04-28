import { forwardRef } from "react";

export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number;
}

export const SkeletonRow = forwardRef<HTMLDivElement, SkeletonRowProps>(
  function SkeletonRow({ height = 44, className = "", style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`ds-shimmer rounded-xl border border-[var(--border)] ${className}`}
        style={{ height, ...style }}
        aria-hidden
        {...rest}
      />
    );
  },
);
