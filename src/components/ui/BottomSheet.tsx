"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Children render inside the sheet body. */
  children: ReactNode;
  /** Disable the backdrop click-to-close. */
  disableBackdropClose?: boolean;
  className?: string;
  /** Width on desktop ("modal" mode). Defaults to 480px. */
  desktopWidth?: number;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  disableBackdropClose = false,
  className = "",
  desktopWidth = 480,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [onClose, open],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = original;
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[250] flex items-end md:items-center md:justify-center"
      style={{ animation: "ds-fade-in 180ms ease-out" }}
      onClick={(e) => {
        if (disableBackdropClose) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(20, 18, 16, 0.55)" }}
      />
      <div
        ref={sheetRef}
        className={`relative z-[1] w-full md:w-auto md:max-w-[calc(100vw-2rem)] max-h-[92vh] overflow-hidden rounded-t-3xl md:rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] backdrop-blur-xl shadow-[0_-18px_60px_rgba(0,0,0,0.18)] ${className}`}
        style={{
          animation: "ds-sheet-up 240ms cubic-bezier(0.32, 0.72, 0, 1)",
          width: undefined,
          maxWidth: "100%",
        }}
        data-bottom-sheet
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="md:hidden mx-auto mt-2 h-1 w-10 rounded-full"
          style={{ background: "var(--border)" }}
          aria-hidden
        />
        {title ? (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div
          className="overflow-y-auto px-5 py-4 md:max-h-[80vh]"
          style={{
            maxHeight: "calc(92vh - 64px)",
            width: "min(100vw, " + desktopWidth + "px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
