"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useIsMobile } from "@/lib/hooks/use-is-mobile";

interface CollapsibleSidebarProps {
  children: React.ReactNode;
  /** Unread notification count surfaced in the mobile top bar. */
  unreadNotifications?: number;
  /** Whether the user has permission to open /app/notifications. */
  canViewNotifications?: boolean;
}

export function CollapsibleSidebar({
  children,
  unreadNotifications = 0,
  canViewNotifications = false,
}: CollapsibleSidebarProps) {
  const isMobile = useIsMobile();
  // Desktop default: open. Mobile default: closed (overlay only).
  // The initial render is server-rendered with `open=true` (no client APIs
  // available); a single mount-effect aligns state with the real viewport.
  const [open, setOpen] = useState(true);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);

  // Sync open state with the current breakpoint. Runs once after mount and
  // again whenever `isMobile` flips. The hook itself is the only place that
  // calls `setState` synchronously in response to a media-query subscription.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Synchronizing React state with the browser viewport / localStorage —
    // both are external systems, not derived state, so setState here is
    // intentional even though the eslint rule flags it.
    if (isMobile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      return;
    }
    const stored = window.localStorage.getItem("sidebar-open");
    setOpen(stored === null ? true : stored === "true");
  }, [isMobile]);

  // Escape closes the drawer on mobile.
  useEffect(() => {
    if (!isMobile || !open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, open]);

  // Lock body scroll while drawer is open on mobile and manage focus.
  useEffect(() => {
    if (!isMobile) return;
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const id = setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => {
        clearTimeout(id);
        document.body.style.overflow = original;
      };
    }
    openBtnRef.current?.focus();
    return undefined;
  }, [isMobile, open]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (!isMobile && typeof window !== "undefined") {
        localStorage.setItem("sidebar-open", String(next));
      }
      return next;
    });
  }

  function close() {
    setOpen(false);
  }

  const panel = (
    <aside
      style={{
        width: "18rem",
        height: "100%",
        overflow: "hidden",
        borderInlineEnd: isMobile ? "none" : "1px solid var(--border)",
        background: "var(--panel)",
        backdropFilter: "blur(14px)",
        flexShrink: 0,
      }}
      onClick={(e) => {
        if (!isMobile) return;
        const target = e.target as HTMLElement | null;
        const a = target?.closest("a");
        if (a) close();
      }}
    >
      <div
        style={{
          width: "18rem",
          padding: "1.5rem",
          height: "100%",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        {/* Sticky top bar — hamburger + app name + notifications bell */}
        <div
          className="dream-mobile-topbar"
          role="banner"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 0.875rem",
            background: "var(--panel-strong)",
            borderBottom: "1px solid var(--border)",
            backdropFilter: "blur(14px)",
            paddingTop: "max(0.625rem, env(safe-area-inset-top))",
          }}
        >
          <button
            ref={openBtnRef}
            onClick={toggle}
            type="button"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
            aria-controls="dream-mobile-drawer"
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: "0.875rem",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <p
            style={{
              flex: 1,
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.04em",
              color: "var(--foreground)",
              margin: 0,
              textAlign: "start",
            }}
          >
            دريم ١
          </p>
          {canViewNotifications ? (
            <Link
              href="/app/notifications"
              aria-label={
                unreadNotifications > 0
                  ? `الإشعارات (${unreadNotifications} غير مقروء)`
                  : "الإشعارات"
              }
              style={{
                position: "relative",
                minWidth: 44,
                minHeight: 44,
                borderRadius: "0.875rem",
                border: "1px solid var(--border)",
                background: "var(--panel)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotifications > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 4,
                    insetInlineEnd: 4,
                    minWidth: 18,
                    height: 18,
                    padding: "0 4px",
                    borderRadius: 9999,
                    background: "var(--tone-blocked-fg, #b91c1c)",
                    color: "white",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          ) : null}
        </div>

        {open && (
          <div
            aria-hidden="true"
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0,0,0,0.45)",
            }}
          />
        )}

        <div
          id="dream-mobile-drawer"
          role="dialog"
          aria-modal={open}
          aria-label="القائمة الجانبية"
          aria-hidden={!open}
          style={{
            position: "fixed",
            top: 0,
            insetInlineStart: 0,
            bottom: 0,
            width: "min(85vw, 18rem)",
            zIndex: 45,
            transform: open ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 220ms ease",
            visibility: open ? "visible" : "hidden",
          }}
        >
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="إغلاق القائمة"
            onClick={close}
            style={{
              position: "absolute",
              top: "0.625rem",
              insetInlineEnd: "0.625rem",
              zIndex: 1,
              minWidth: 44,
              minHeight: 44,
              borderRadius: "0.875rem",
              border: "1px solid var(--border)",
              background: "var(--panel-strong)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {panel}
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: open ? "18rem" : 0,
        transition: "width 220ms ease",
        zIndex: 20,
        alignSelf: "stretch",
      }}
    >
      <button
        onClick={toggle}
        type="button"
        aria-label={open ? "طي الشريط الجانبي" : "توسيع الشريط الجانبي"}
        style={{
          position: "absolute",
          top: "1rem",
          insetInlineEnd: open ? "-14px" : "-36px",
          zIndex: 10,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: "var(--panel-strong)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "inset-inline-end 220ms ease",
          boxShadow: "var(--shadow)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 220ms ease",
          }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <aside
        style={{
          width: open ? "18rem" : 0,
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
          transition: "width 220ms ease",
          borderInlineEnd: "1px solid var(--border)",
          background: "var(--panel)",
          backdropFilter: "blur(14px)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "18rem",
            padding: "1.5rem",
            height: "100%",
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
