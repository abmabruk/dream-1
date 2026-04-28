"use client";

import { useEffect, useState, useCallback } from "react";

import type { OpsBoardData } from "@/modules/projects/project.schemas";

interface Args {
  queue: OpsBoardData["queue"];
  canManage: boolean;
  onStatusChange: (queueItemId: string, status: string) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Visible keyboard navigation/actions for the ops board:
 *   J / K  → move focus across queue cards (TaskCard data-task-id)
 *   T      → move focused queue item → IN_PROGRESS (today/active lane)
 *   D      → mark focused queue item → DONE
 *   ?      → show a small help popover
 *   /      → focus the universal command palette
 */
export function useOpsShortcuts({ queue, canManage, onStatusChange }: Args) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const focusByIndex = useCallback(
    (idx: number) => {
      const card = document.querySelector<HTMLElement>(`[data-queue-index="${idx}"]`);
      if (card) {
        card.focus();
        card.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    },
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      // Ignore shortcuts that have modifiers (Cmd+K is owned by CommandPalette)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
      }

      const lower = key.toLowerCase();

      if (lower === "j") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = Math.min(queue.length - 1, i + 1);
          focusByIndex(next);
          return next;
        });
        return;
      }
      if (lower === "k") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = Math.max(0, i < 0 ? 0 : i - 1);
          focusByIndex(next);
          return next;
        });
        return;
      }
      if (!canManage) return;

      if (lower === "t") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const item = queue[i];
          if (item) onStatusChange(item.id, "IN_PROGRESS");
          return i;
        });
        return;
      }
      if (lower === "d") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const item = queue[i];
          if (item) onStatusChange(item.id, "DONE");
          return i;
        });
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, canManage, onStatusChange, helpOpen, focusByIndex]);

  return { helpOpen, setHelpOpen, focusedIndex };
}

export function ShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const rows: { keys: string; label: string }[] = [
    { keys: "J / K", label: "تنقّل بين بطاقات الطابور" },
    { keys: "T", label: "نقل المهمة المحددة إلى التنفيذ" },
    { keys: "D", label: "تحديد كمنجز" },
    { keys: "⌘K", label: "بحث شامل" },
    { keys: "/", label: "فتح البحث" },
    { keys: "?", label: "هذه الشاشة" },
  ];
  return (
    <div
      role="dialog"
      aria-label="اختصارات لوحة المفاتيح"
      className="fixed bottom-6 z-[260] rounded-2xl border bg-[var(--panel)] backdrop-blur-md p-3 shadow-[0_18px_50px_rgba(20,14,4,0.22)]"
      style={{ insetInlineStart: "1.5rem", borderColor: "var(--border)", minWidth: 240 }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[var(--muted-foreground)]">اختصارات</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="size-6 rounded-full text-xs hover:bg-[var(--panel-strong)]"
        >
          ✕
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.keys} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--foreground)]">{r.label}</span>
            <kbd
              className="rounded-md border px-1.5 py-0.5 text-[0.65rem] font-mono"
              style={{ borderColor: "var(--border)", background: "var(--panel-strong)" }}
            >
              {r.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
