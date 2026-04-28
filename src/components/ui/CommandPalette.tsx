"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResultType = "project" | "task" | "customer" | "order";

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_LABELS_AR: Record<SearchResultType, string> = {
  project: "مشروع",
  task: "مهمة",
  customer: "عميل",
  order: "طلب",
};

const TYPE_TONES: Record<SearchResultType, { bg: string; fg: string }> = {
  project: { bg: "var(--tone-in-progress-bg)", fg: "var(--tone-in-progress-fg)" },
  task: { bg: "var(--tone-planned-bg)", fg: "var(--tone-planned-fg)" },
  customer: { bg: "var(--tone-waiting-bg)", fg: "var(--tone-waiting-fg)" },
  order: { bg: "var(--tone-done-bg)", fg: "var(--tone-done-fg)" },
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  // Global hotkey: Cmd/Ctrl+K + "/" focus shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isTyping && !open) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // Listen for a custom event to open the palette programmatically.
      // (Used by ops shortcut hook.)
    }
    window.addEventListener("keydown", onKey);
    function onCustomOpen() {
      setOpen(true);
    }
    window.addEventListener("dream:command-palette:open", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dream:command-palette:open", onCustomOpen);
    };
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, {
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (myReqId !== reqIdRef.current) return;
        if (json.ok) {
          setResults(json.data as SearchResult[]);
          setActiveIndex(0);
        }
      } catch {
        // ignore
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [query, open]);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (r: SearchResult) => {
      router.push(r.href);
      close();
    },
    [router, close],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(results.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const r = results[activeIndex];
        if (r) navigate(r);
      }
    },
    [results, activeIndex, navigate, close],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="بحث شامل"
      className="fixed inset-0 z-[400] flex items-start justify-center pt-[12vh] px-4"
      onClick={close}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(20,14,4,0.42)", backdropFilter: "blur(2px)" }}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl border bg-[var(--panel)] backdrop-blur-md shadow-[0_30px_80px_rgba(20,14,4,0.32)]"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden className="text-[var(--muted-foreground)] text-sm">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="ابحث عن مشروع أو مهمة أو عميل..."
            dir="rtl"
            className="flex-1 bg-transparent outline-none text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          {loading ? <span className="text-xs text-[var(--muted-foreground)]">...</span> : null}
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-1">
          {results.length === 0 && query.trim().length > 0 && !loading ? (
            <p className="px-4 py-6 text-sm text-[var(--muted-foreground)] text-center">
              لا توجد نتائج
            </p>
          ) : null}
          {results.length === 0 && query.trim().length === 0 ? (
            <p className="px-4 py-6 text-xs text-[var(--muted-foreground)] text-center">
              ابدأ الكتابة للبحث · ↑↓ للتنقل · Enter للفتح · Esc للإغلاق
            </p>
          ) : null}
          {results.map((r, i) => {
            const tone = TYPE_TONES[r.type];
            const active = i === activeIndex;
            return (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => navigate(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors"
                style={{
                  background: active ? "var(--panel-strong)" : "transparent",
                }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[0.65rem] font-bold shrink-0"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {TYPE_LABELS_AR[r.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                    {r.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                    {r.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
