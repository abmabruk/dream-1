"use client";

import { useEffect } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; fg: string; border: string }> = {
  success: {
    bg: "var(--tone-done-bg)",
    fg: "var(--tone-done-fg)",
    border: "var(--tone-done-border)",
  },
  error: {
    bg: "var(--tone-blocked-bg)",
    fg: "var(--tone-blocked-fg)",
    border: "var(--tone-blocked-border)",
  },
  info: {
    bg: "var(--tone-in-progress-bg)",
    fg: "var(--tone-in-progress-fg)",
    border: "var(--tone-in-progress-border)",
  },
};

const ICON: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

const ICON_BG: Record<ToastVariant, string> = {
  success: "var(--tone-done-fg)",
  error: "var(--tone-blocked-fg)",
  info: "var(--tone-in-progress-fg)",
};

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.id, toast.durationMs, onDismiss]);

  const style = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => onDismiss(toast.id)}
      className="flex items-center gap-3 rounded-2xl border ps-3 pe-2 py-2.5 backdrop-blur-md shadow-[0_18px_50px_rgba(64,48,27,0.18)] min-w-[260px] max-w-[420px] cursor-pointer"
      style={{
        background: style.bg,
        borderColor: style.border,
        color: style.fg,
        animation: "ds-toast-slide-in 240ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: ICON_BG[toast.variant], color: "var(--accent-foreground)" }}
      >
        {ICON[toast.variant]}
      </span>
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        aria-label="إغلاق"
        className="size-6 rounded-full text-current opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
