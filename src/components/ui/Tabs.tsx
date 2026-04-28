"use client";

/**
 * Lightweight Tabs primitive — RTL-aware, keyboard-navigable, optional
 * URL syncing via `?tab=...`.
 *
 * Usage:
 *
 *   <Tabs defaultValue="tasks" syncWithUrl>
 *     <TabsList>
 *       <TabsTrigger value="tasks">المهام</TabsTrigger>
 *       <TabsTrigger value="activity">السجل</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="tasks">…</TabsContent>
 *     <TabsContent value="activity">…</TabsContent>
 *   </Tabs>
 *
 * Children of <TabsList> are reordered via roving tabindex; arrow keys
 * (←/→ — swapped under RTL) move focus and switch the active tab.
 */

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  /** Stable group id used to wire aria-controls / aria-labelledby. */
  groupId: string;
  /** Ordered list of registered tab values, used for arrow navigation. */
  values: string[];
  registerValue: (value: string) => () => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Tabs>.`);
  }
  return ctx;
}

export interface TabsProps {
  /** Initial value when neither `value` nor URL provides one. */
  defaultValue: string;
  /** Controlled value. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Sync the active tab to `?tab=…` in the URL. Defaults to true. */
  syncWithUrl?: boolean;
  /** URL parameter name when `syncWithUrl` is on. Defaults to `tab`. */
  urlParam?: string;
  className?: string;
  children: ReactNode;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  syncWithUrl = true,
  urlParam = "tab",
  className = "",
  children,
}: TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = useId();

  const urlValue = syncWithUrl ? searchParams?.get(urlParam) : null;
  const initial = controlledValue ?? urlValue ?? defaultValue;
  const [internal, setInternal] = useState<string>(initial);

  const value = controlledValue ?? internal;

  const setValue = useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setInternal(next);
      }
      onValueChange?.(next);

      if (syncWithUrl && typeof window !== "undefined") {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (next === defaultValue) {
          params.delete(urlParam);
        } else {
          params.set(urlParam, next);
        }
        const qs = params.toString();
        const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${
          window.location.hash || ""
        }`;
        router.replace(url, { scroll: false });
      }
    },
    [controlledValue, defaultValue, onValueChange, router, searchParams, syncWithUrl, urlParam]
  );

  // Keep internal in sync if URL changes externally (e.g. back button).
  useEffect(() => {
    if (controlledValue !== undefined) return;
    if (!syncWithUrl) return;
    if (urlValue && urlValue !== internal) {
      setInternal(urlValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue]);

  // Track the registration order of <TabsTrigger> values so that arrow-key
  // navigation can step through them.
  const registryRef = useRef<string[]>([]);
  const [, forceRender] = useState(0);

  const registerValue = useCallback((triggerValue: string) => {
    if (!registryRef.current.includes(triggerValue)) {
      registryRef.current = [...registryRef.current, triggerValue];
      forceRender((n) => n + 1);
    }
    return () => {
      registryRef.current = registryRef.current.filter((v) => v !== triggerValue);
      forceRender((n) => n + 1);
    };
  }, []);

  const ctx = useMemo<TabsContextValue>(
    () => ({
      value,
      setValue,
      groupId,
      values: registryRef.current,
      registerValue,
    }),
    [value, setValue, groupId, registerValue]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}

export function TabsList({ className = "", children, ariaLabel }: TabsListProps) {
  const { value, setValue, values } = useTabs("TabsList");
  const listRef = useRef<HTMLDivElement | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isHorizontalArrow =
      event.key === "ArrowLeft" || event.key === "ArrowRight";
    const isVerticalArrow = event.key === "Home" || event.key === "End";
    if (!isHorizontalArrow && !isVerticalArrow) return;

    event.preventDefault();
    const idx = values.indexOf(value);
    if (idx < 0 || values.length === 0) return;

    const isRtl =
      typeof document !== "undefined" &&
      (document.documentElement.dir === "rtl" ||
        getComputedStyle(document.documentElement).direction === "rtl");

    let nextIdx = idx;
    if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = values.length - 1;
    } else if (event.key === "ArrowLeft") {
      // In RTL, ArrowLeft visually moves to the next tab.
      nextIdx = isRtl ? (idx + 1) % values.length : (idx - 1 + values.length) % values.length;
    } else if (event.key === "ArrowRight") {
      nextIdx = isRtl ? (idx - 1 + values.length) % values.length : (idx + 1) % values.length;
    }

    const nextValue = values[nextIdx];
    if (nextValue) {
      setValue(nextValue);
      // Move focus to the now-active trigger.
      const node = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-value="${CSS.escape(nextValue)}"]`
      );
      node?.focus();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={
        "flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] " +
        className
      }
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

export function TabsTrigger({ value, className = "", disabled, children }: TabsTriggerProps) {
  const { value: active, setValue, registerValue, groupId } = useTabs("TabsTrigger");

  useEffect(() => registerValue(value), [registerValue, value]);

  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      data-tab-value={value}
      data-state={selected ? "active" : "inactive"}
      aria-selected={selected}
      aria-controls={`${groupId}-panel-${value}`}
      id={`${groupId}-trigger-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && setValue(value)}
      className={
        "shrink-0 cursor-pointer px-4 py-2.5 text-sm transition-colors -mb-px border-b-2 " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:rounded-md " +
        (selected
          ? "border-[var(--accent)] text-[var(--foreground)] font-semibold"
          : "border-transparent text-[var(--muted-foreground)] hover:bg-black/5 hover:text-[var(--foreground)] font-medium") +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  className?: string;
  /**
   * When true (default), the panel is removed from the DOM when not active.
   * Set false to keep mounted (preserves scroll/state but heavier).
   */
  unmountInactive?: boolean;
  children: ReactNode;
}

export function TabsContent({
  value,
  className = "",
  unmountInactive = true,
  children,
}: TabsContentProps) {
  const { value: active, groupId } = useTabs("TabsContent");
  const selected = active === value;

  if (unmountInactive && !selected) return null;

  return (
    <div
      role="tabpanel"
      id={`${groupId}-panel-${value}`}
      aria-labelledby={`${groupId}-trigger-${value}`}
      hidden={!selected}
      className={className}
    >
      {selected ? children : null}
    </div>
  );
}

/* Helper: filter `<TabsTrigger>`/`<TabsContent>` children by a permission gate. */
export function filterTabChildren(
  children: ReactNode,
  predicate: (value: string) => boolean
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as { value?: string };
    if (typeof props.value === "string" && !predicate(props.value)) {
      return null;
    }
    return cloneElement(child as ReactElement);
  });
}
