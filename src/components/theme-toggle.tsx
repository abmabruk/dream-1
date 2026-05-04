"use client";

import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{ value: Theme; label: string; icon: string }> = [
  { value: "light", label: "فاتح", icon: "☀" },
  { value: "system", label: "النظام", icon: "💻" },
  { value: "dark", label: "داكن", icon: "🌙" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="نمط العرض"
      className="inline-flex w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] p-1"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={[
              "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            <span aria-hidden>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
