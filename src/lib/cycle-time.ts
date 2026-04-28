/**
 * Wave 3 — cycle-time helper.
 *
 * Computes the elapsed days for a stage instance and compares it to the
 * stage's expected cycle time. Used by the project hub to color the
 * timeline circles and surface a small "متأخر" badge in the drawer.
 */

export interface CycleTimeStage {
  startedAt: string | null;
  completedAt: string | null;
  expectedDays: number | null;
}

export interface CycleTimeResult {
  /** Whole days between start and (completedAt ?? now). 0 if not started. */
  days: number;
  /** Stage's expected cycle in days, or null when no benchmark exists. */
  expected: number | null;
  /** Verdict — "ok" within budget, "over" past expectedDays, or "no-benchmark". */
  status: "ok" | "over" | "no-benchmark";
}

/** ms in a day */
const DAY = 24 * 60 * 60 * 1000;

export function computeCycleTime(stage: CycleTimeStage): CycleTimeResult {
  if (!stage.startedAt) {
    return {
      days: 0,
      expected: stage.expectedDays ?? null,
      status: stage.expectedDays ? "ok" : "no-benchmark",
    };
  }
  const start = new Date(stage.startedAt).getTime();
  const end = stage.completedAt
    ? new Date(stage.completedAt).getTime()
    : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return {
      days: 0,
      expected: stage.expectedDays ?? null,
      status: stage.expectedDays ? "ok" : "no-benchmark",
    };
  }
  const days = Math.max(0, Math.floor((end - start) / DAY));
  if (!stage.expectedDays || stage.expectedDays <= 0) {
    return { days, expected: null, status: "no-benchmark" };
  }
  return {
    days,
    expected: stage.expectedDays,
    status: days > stage.expectedDays ? "over" : "ok",
  };
}
