"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { MetricCard, TaskCard } from "@/components/ui";
import type { OpsBoardData } from "@/modules/projects/project.schemas";
import type { Priority } from "@/lib/status-tone";

type Metrics = {
  completedToday: number;
  inProgress: number;
  blocked: number;
  remaining: number;
};

type ActiveProject = {
  id: string;
  code: string;
  name: string;
  status: string;
  priority: Priority;
  done: number;
  total: number;
  queuedTodayCount: number;
  currentStageName: string | null;
};

type Alert = {
  id: string;
  title: string;
  projectCode: string;
  assigneeName: string | null;
  tone: "blocked" | "waiting";
  label: string;
};

type TeamMember = {
  id: string;
  displayName: string;
  role: string;
  currentTaskTitle: string | null;
};

export interface FloorDisplayProps {
  factoryName: string;
  metrics: Metrics;
  queue: OpsBoardData["queue"];
  projects: ActiveProject[];
  alerts: Alert[];
  team: TeamMember[];
  generatedAtIso: string;
}

const REFRESH_MS = 20_000;

const TIME_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const STAMP_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function priorityFromString(p: string): Priority {
  if (p === "URGENT" || p === "HIGH" || p === "MEDIUM" || p === "LOW") return p;
  return "MEDIUM";
}

const QUEUE_GROUP_ORDER = [
  { key: "IN_PROGRESS", label: "قيد التنفيذ الآن" },
  { key: "WAITING_APPROVAL", label: "بانتظار الموافقة" },
  { key: "PLANNED", label: "في الطابور" },
  { key: "DONE", label: "مكتمل اليوم" },
] as const;

export function FloorDisplay({
  factoryName,
  metrics,
  queue,
  projects,
  alerts,
  team,
  generatedAtIso,
}: FloorDisplayProps) {
  const router = useRouter();

  const [now, setNow] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Show floating controls on mouse activity, auto-hide after 3s.
  useEffect(() => {
    const reveal = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };
    window.addEventListener("mousemove", reveal);
    window.addEventListener("touchstart", reveal);
    return () => {
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("touchstart", reveal);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Track fullscreen state.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const refreshNow = useCallback(() => {
    setPulse(true);
    router.refresh();
    window.setTimeout(() => setPulse(false), 900);
  }, [router]);

  // Live ticking clock — initialized on mount only to avoid hydration drift.
  // The initial setNow synchronizes React state with the real wall-clock
  // (an external system), so setState in this effect is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh every REFRESH_MS via router.refresh() (no flicker, no full reload).
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      router.refresh();
      // Ease the pulse out shortly after triggering refresh.
      window.setTimeout(() => setPulse(false), 900);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  // Group the queue once per render, preserving the per-status position order.
  const grouped: Record<string, OpsBoardData["queue"]> = {
    IN_PROGRESS: [],
    WAITING_APPROVAL: [],
    PLANNED: [],
    BLOCKED: [],
    DONE: [],
  };
  for (const item of queue) {
    if (grouped[item.status]) grouped[item.status].push(item);
  }
  // Show BLOCKED inline with WAITING_APPROVAL visually (both are "needs attention")
  const stamp = new Date(generatedAtIso);

  return (
    <>
      {/* ── Floating controls (hidden until mouse moves) ─────────────────── */}
      <div
        className="floor-controls"
        data-visible={controlsVisible ? "true" : "false"}
        aria-hidden={!controlsVisible}
      >
        <Link
          href="/app"
          className="floor-controls-btn"
          aria-label="رجوع للتطبيق"
          title="رجوع للتطبيق"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={refreshNow}
          className="floor-controls-btn"
          aria-label="تحديث الآن"
          title="تحديث الآن"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="floor-controls-btn"
          aria-label={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="floor-topbar">
        <div>
          <p
            className="text-[var(--muted-foreground)]"
            style={{ fontSize: "var(--floor-label)" }}
          >
            شاشة المصنع
          </p>
          <h1 className="floor-factory-name" style={{ marginTop: "0.25rem" }}>
            {factoryName}
          </h1>
          <p
            className="text-[var(--muted-foreground)]"
            style={{ fontSize: "var(--floor-label)", marginTop: "0.15rem" }}
            suppressHydrationWarning
          >
            {now ? DATE_FORMATTER.format(now) : ""}
          </p>
        </div>

        <div
          className="floor-clock"
          aria-live="off"
          suppressHydrationWarning
        >
          <span
            className="floor-pulse"
            data-active={pulse ? "true" : "false"}
            aria-hidden
          />
          <span>{now ? TIME_FORMATTER.format(now) : "--:--:--"}</span>
        </div>

        <div className="floor-stamp" suppressHydrationWarning>
          آخر تحديث: {STAMP_FORMATTER.format(stamp)}
        </div>
      </header>

      {/* ── Metrics row (hierarchy: positive momentum bigger; blocked glows when > 0) ── */}
      <section className="floor-metrics" aria-label="مؤشرات اليوم">
        <MetricCard
          className="floor-metric-primary"
          label="مكتمل اليوم"
          value={metrics.completedToday}
          tone="accent"
          sublabel="مهام تم إنجازها"
          trend="up"
        />
        <MetricCard
          className="floor-metric-primary"
          label="قيد التنفيذ"
          value={metrics.inProgress}
          tone="accent"
          sublabel="جارية الآن"
        />
        <MetricCard
          className={`floor-metric-secondary ${metrics.blocked > 0 ? "floor-metric-danger-glow" : ""}`}
          label="متوقف"
          value={metrics.blocked}
          tone="danger"
          sublabel="يحتاج انتباه"
          trend={metrics.blocked > 0 ? "down" : "flat"}
        />
        <MetricCard
          className="floor-metric-secondary"
          label="متبقي"
          value={metrics.remaining}
          tone="default"
          sublabel="مخطط أو بانتظار الموافقة"
        />
      </section>

      {/* ── Three-column body ───────────────────────────────────────────── */}
      {/* In RTL the visual right column = first DOM child. */}
      <main className="floor-body">
        {/* Right (RTL-right) — Active projects rail */}
        <aside className="floor-col" aria-label="المشاريع النشطة">
          <section className="floor-col-section">
            <h2 className="floor-section-title">
              <span>المشاريع النشطة</span>
              <span className="floor-section-title-count">{projects.length}</span>
            </h2>
            <div className="floor-section-body">
              {projects.length === 0 ? (
                <div className="floor-empty">لا توجد مشاريع نشطة الآن</div>
              ) : (
                projects.map((p) => {
                  const pct =
                    p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                  return (
                    <div key={p.id} className="floor-project-row">
                      <div className="floor-project-head">
                        <span className="floor-project-code">{p.code}</span>
                        <PriorityDotInline priority={p.priority} />
                      </div>
                      <div className="floor-project-name" title={p.name}>
                        {p.name}
                      </div>
                      <div className="floor-project-stage">
                        المرحلة: {p.currentStageName ?? "—"}
                      </div>
                      <div
                        className="floor-project-bar"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="floor-project-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="floor-project-meta">
                        <span>
                          {p.done}/{p.total} مهمة
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </aside>

        {/* Center — Today's queue */}
        <section className="floor-col" aria-label="طابور اليوم">
          <div className="floor-col-section floor-queue">
            <h2 className="floor-section-title">
              <span>طابور اليوم</span>
              <span className="floor-section-title-count">{queue.length}</span>
            </h2>
            <div className="floor-section-body">
              {queue.length === 0 ? (
                <div className="floor-empty">لا توجد مهام في طابور اليوم</div>
              ) : (
                QUEUE_GROUP_ORDER.map((group) => {
                  const items = grouped[group.key];
                  if (!items || items.length === 0) return null;
                  return (
                    <div
                      key={group.key}
                      className={
                        group.key === "DONE" ? "floor-queue-done" : undefined
                      }
                    >
                      <div className="floor-queue-group-label">
                        {group.label} · {items.length}
                      </div>
                      {items.map((item) => (
                        <TaskCard
                          key={item.id}
                          id={item.id}
                          title={item.task.title}
                          status={item.status}
                          priority={priorityFromString(item.task.priority)}
                          projectCode={item.task.projectCode}
                          assigneeName={item.assignedToName}
                          // No action handlers passed → no buttons rendered.
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Left (RTL-left) — Alerts (top) + Team (bottom) */}
        <aside className="floor-col" aria-label="التنبيهات والفِرق">
          <section className="floor-col-section">
            <h2 className="floor-section-title">
              <span>التنبيهات</span>
              <span className="floor-section-title-count">{alerts.length}</span>
            </h2>
            <div className="floor-section-body">
              {alerts.length === 0 ? (
                <div className="floor-empty">لا توجد تنبيهات</div>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="floor-alert" data-tone={a.tone}>
                    <div className="floor-alert-title">
                      <span aria-hidden>{a.tone === "blocked" ? "■" : "●"}</span>
                      <span>{a.title}</span>
                    </div>
                    <div className="floor-alert-meta">
                      {a.projectCode}
                      {a.assigneeName ? ` · ${a.assigneeName}` : ""} · {a.label}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="floor-col-section">
            <h2 className="floor-section-title">
              <span>الفِرق</span>
              <span className="floor-section-title-count">{team.length}</span>
            </h2>
            <div className="floor-section-body">
              {team.length === 0 ? (
                <div className="floor-empty">لا يوجد عاملون نشطون</div>
              ) : (
                team.map((member) => {
                  const busy = Boolean(member.currentTaskTitle);
                  return (
                    <div key={member.id} className="floor-worker">
                      <span
                        className="floor-worker-dot"
                        data-busy={busy ? "true" : "false"}
                        aria-hidden
                      />
                      <span className="floor-worker-name">
                        {member.displayName}
                      </span>
                      <span
                        className="floor-worker-task"
                        data-free={busy ? "false" : "true"}
                        title={member.currentTaskTitle ?? "متاح"}
                      >
                        {member.currentTaskTitle ?? "متاح"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </main>
    </>
  );
}

/** Lightweight inline priority dot — slightly larger than the shared one
 *  to stay legible from 5 m. Mirrors the PriorityDot component's color
 *  semantics but isn't interactive. */
function PriorityDotInline({ priority }: { priority: Priority }) {
  const color =
    priority === "URGENT"
      ? "var(--priority-urgent)"
      : priority === "HIGH"
        ? "var(--priority-high)"
        : priority === "MEDIUM"
          ? "var(--priority-medium)"
          : "var(--priority-low)";
  const isUrgent = priority === "URGENT";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "0.6rem",
        height: "0.6rem",
        borderRadius: "999px",
        background: color,
        animation: isUrgent ? "ds-pulse 1.4s ease-in-out infinite" : undefined,
      }}
    />
  );
}
