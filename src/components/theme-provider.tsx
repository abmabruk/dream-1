"use client";

/**
 * Theme system (Phase 7).
 *
 * - Default theme is "light" (the app was previously locked to light).
 * - Users can opt-in to "dark" or "system" via the sidebar toggle.
 * - Preference is stored in `localStorage["dream-theme"]`.
 * - The `<ThemeScript />` component renders a synchronous inline script in
 *   <head> that applies the `.dark` class on <html> before React hydrates,
 *   so there is no flash of light content (FOUC) on dark-mode reloads.
 *
 * The customer portal (/portal/*) is intentionally light-only — see
 * `globals.css`. The script below only checks localStorage; portal pages
 * simply don't render the toggle, and we never write "dark" unless the user
 * picks it from the toggle inside the authenticated app.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "dream-theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private mode, SSR fallback) — ignore.
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init reads localStorage once on client mount; on SSR returns "light".
  // The inline ThemeScript already applied the class to <html> before hydration.
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  // React to OS preference changes when "system" is selected.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    applyTheme(next);
  }, []);

  const resolvedTheme = useMemo<"light" | "dark">(() => {
    if (theme === "system") {
      if (typeof window === "undefined") return "light";
      return getSystemTheme();
    }
    return theme;
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Soft fallback so consuming components don't crash if rendered outside
    // the provider (e.g. the customer portal).
    return {
      theme: "light",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}

/**
 * Inline <script> rendered in the document <head> that applies the dark
 * class before React hydrates. Must be a server component returning a
 * <script dangerouslySetInnerHTML> — runs once, synchronously.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t==='system'&&m);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  return (
    <script
       
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
