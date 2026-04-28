"use client";

/**
 * Wave 2 — Stage timeline strip rendered at the top of the Project Hub.
 *
 * Renders a horizontal sequence of circles (one per stage instance) joined
 * by connector lines. Each circle reflects the instance status:
 *
 *   COMPLETED   → filled green with a check
 *   IN_PROGRESS → filled teal with a pulse
 *   NOT_STARTED → outlined only
 *   BLOCKED     → filled red
 *   SKIPPED     → outlined with a strike-through
 *
 * Overdue IN_PROGRESS stages (running longer than their `expectedDays`)
 * pick up an amber tint to flag the slip without changing status.
 *
 * The strip is RTL-native: the underlying flexbox uses `direction: rtl`
 * so the first stage sits on the right. On narrow screens it scrolls
 * horizontally with snap-points so a single tap aligns one circle.
 */

import { useCallback } from "react";

import { computeCycleTime } from "@/lib/cycle-time";
import type { StageInstanceItem } from "@/modules/projects/project.schemas";

interface Props {
  stageInstances: StageInstanceItem[];
  projectId: string;
  canManage: boolean;
  onOpenStage: (stageInstanceId: string) => void;
}

const CIRCLE_SIZE = 40;

function isOverdue(stage: StageInstanceItem): boolean {
  if (stage.status !== "IN_PROGRESS") return false;
  return computeCycleTime(stage).status === "over";
}

function statusVisuals(stage: StageInstanceItem) {
  const overdue = isOverdue(stage);
  switch (stage.status) {
    case "COMPLETED":
      return {
        bg: "#10b981",
        border: "#10b981",
        fg: "#ffffff",
        glyph: "✓",
        pulse: false,
        struck: false,
      };
    case "IN_PROGRESS":
      return {
        bg: overdue ? "#f59e0b" : "#14b8a6",
        border: overdue ? "#f59e0b" : "#14b8a6",
        fg: "#ffffff",
        glyph: "",
        pulse: true,
        struck: false,
      };
    case "BLOCKED":
      return {
        bg: "#ef4444",
        border: "#ef4444",
        fg: "#ffffff",
        glyph: "!",
        pulse: false,
        struck: false,
      };
    case "SKIPPED":
      return {
        bg: "transparent",
        border: "var(--border)",
        fg: "var(--muted-foreground)",
        glyph: "",
        pulse: false,
        struck: true,
      };
    case "NOT_STARTED":
    default:
      return {
        bg: "transparent",
        border: "var(--border)",
        fg: "var(--muted-foreground)",
        glyph: "",
        pulse: false,
        struck: false,
      };
  }
}

export function StagesTimeline({
  stageInstances,
  canManage,
  onOpenStage,
}: Props) {
  const handleClick = useCallback(
    (id: string) => () => {
      if (!canManage) return;
      onOpenStage(id);
    },
    [onOpenStage, canManage]
  );

  if (!stageInstances || stageInstances.length === 0) {
    return null;
  }

  const sorted = [...stageInstances].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4"
      aria-label="مراحل المشروع"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          مراحل المشروع
        </h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {sorted.filter((s) => s.status === "COMPLETED").length} /{" "}
          {sorted.length} مكتمل
        </span>
      </div>

      <div
        className="dream-stage-strip flex items-start gap-0 overflow-x-auto pb-2"
        style={{ direction: "rtl", scrollSnapType: "x mandatory" }}
      >
        {sorted.map((stage, idx) => {
          const v = statusVisuals(stage);
          const isLast = idx === sorted.length - 1;
          const overdue = isOverdue(stage);
          const connectorActive =
            stage.status === "COMPLETED" ||
            (idx + 1 < sorted.length &&
              sorted[idx + 1].status !== "NOT_STARTED");
          return (
            <div
              key={stage.id}
              className="flex shrink-0 items-start"
              style={{ scrollSnapAlign: "center" }}
            >
              <div className="flex w-[112px] flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={canManage ? handleClick(stage.id) : undefined}
                  disabled={!canManage}
                  className={`relative flex items-center justify-center rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    canManage
                      ? "cursor-pointer transition-transform hover:scale-105"
                      : "cursor-default"
                  }`}
                  style={{
                    width: CIRCLE_SIZE,
                    height: CIRCLE_SIZE,
                    background: v.bg,
                    borderColor: v.border,
                    color: v.fg,
                    boxShadow: v.pulse
                      ? `0 0 0 0 ${v.bg}66`
                      : undefined,
                    animation: v.pulse
                      ? "ds-stage-pulse 1.6s ease-out infinite"
                      : undefined,
                  }}
                  aria-label={`المرحلة ${stage.name}`}
                  title={stage.name}
                >
                  <span
                    className="text-sm font-bold"
                    style={{
                      textDecoration: v.struck ? "line-through" : undefined,
                    }}
                  >
                    {v.glyph || idx + 1}
                  </span>
                  {overdue ? (
                    <span
                      aria-hidden
                      className="absolute -top-1 -end-1 size-2.5 rounded-full"
                      style={{
                        background: "#f59e0b",
                        boxShadow: "0 0 6px rgba(245,158,11,0.6)",
                      }}
                    />
                  ) : null}
                </button>
                <p
                  className="line-clamp-2 px-1 text-center text-[11px] font-medium leading-tight"
                  style={{
                    color:
                      stage.status === "IN_PROGRESS"
                        ? "var(--foreground)"
                        : "var(--muted-foreground)",
                    minHeight: "2.4em",
                  }}
                >
                  {stage.name}
                </p>
              </div>
              {!isLast ? (
                <div
                  aria-hidden
                  className="mt-[19px] h-[2px] w-10 shrink-0 md:w-14"
                  style={{
                    background: connectorActive
                      ? "#10b981"
                      : "var(--border)",
                    opacity: connectorActive ? 0.7 : 1,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes ds-stage-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.55);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(20, 184, 166, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
          }
        }
      `}</style>
    </section>
  );
}
