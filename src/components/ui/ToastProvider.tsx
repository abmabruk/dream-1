"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Toast, type ToastItem, type ToastVariant } from "./Toast";

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, variant = "info", durationMs = 3000) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setItems((prev) => [...prev, { id, message, variant, durationMs }]);
    },
    [],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 inset-x-0 z-[300] flex justify-end px-4"
        style={{ paddingInlineEnd: "1rem" }}
      >
        <div className="flex flex-col gap-2 pointer-events-auto" style={{ alignItems: "flex-end" }}>
          {items.map((item) => (
            <Toast key={item.id} toast={item} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback: log to console so callers don't crash if a tree forgot
    // to mount <ToastProvider />. Phase 3 will wire the provider into the
    // app shell.
    return {
      toast: (msg, variant = "info") => {
        if (typeof console !== "undefined") {
          console.warn(`[toast:${variant}] ${msg} (no <ToastProvider /> in tree)`);
        }
      },
    };
  }
  return ctx;
}
