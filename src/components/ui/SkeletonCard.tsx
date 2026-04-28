import { forwardRef } from "react";

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of body lines. Default 3. */
  lines?: number;
}

export const SkeletonCard = forwardRef<HTMLDivElement, SkeletonCardProps>(
  function SkeletonCard({ lines = 3, className = "", style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`panel ${className}`}
        style={style}
        aria-hidden
        {...rest}
      >
        <div className="ds-shimmer h-4 w-1/3 rounded-md" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="ds-shimmer h-3 rounded-md"
              style={{ width: `${100 - i * 12}%` }}
            />
          ))}
        </div>
      </div>
    );
  },
);
