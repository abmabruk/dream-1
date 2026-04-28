/**
 * Maps every status enum used across the app (orders, projects, tasks,
 * queue, assignments, CRM inquiries) to a single unified "tone" so the UI
 * can render consistent colors, pills, and badges everywhere.
 *
 * See `src/styles/tokens.css` for the actual color values per tone.
 */

export type Tone =
  | "draft"
  | "planned"
  | "in-progress"
  | "waiting"
  | "blocked"
  | "done"
  | "cancelled";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const STATUS_TO_TONE: Record<string, Tone> = {
  // OrderStatus
  DRAFT: "draft",
  QUOTED: "waiting",
  APPROVED: "planned",
  IN_PRODUCTION: "in-progress",
  QUALITY_CHECK: "waiting",
  READY_FOR_DELIVERY: "planned",
  DELIVERED: "done",

  // ProjectStatus
  PLANNING: "draft",
  READY: "planned",
  ON_HOLD: "blocked",
  COMPLETED: "done",

  // ProjectTaskStatus
  BACKLOG: "draft",
  PLANNED_TODAY: "planned",
  WAITING_APPROVAL: "waiting",
  DONE: "done",

  // WorkQueueStatus + AssignmentStatus
  PLANNED: "planned",

  // shared across many enums
  IN_PROGRESS: "in-progress",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",

  // InquiryStage
  NEW: "planned",
  CONTACTED: "planned",
  QUALIFIED: "in-progress",
  // QUOTED → "waiting" (already mapped above via OrderStatus)
  WON: "done",
  LOST: "cancelled",
};

/**
 * Resolves any known status string to a Tone. Unknown inputs fall back to
 * "draft" so the UI never crashes.
 */
export function statusToTone(status: string): Tone {
  return STATUS_TO_TONE[status] ?? "draft";
}

export const TONE_LABELS_AR: Record<Tone, string> = {
  draft: "مسودة",
  planned: "مخطط",
  "in-progress": "قيد التنفيذ",
  waiting: "بانتظار",
  blocked: "متوقف",
  done: "منجز",
  cancelled: "ملغي",
};

export const PRIORITY_LABELS_AR: Record<Priority, string> = {
  LOW: "منخفض",
  MEDIUM: "متوسط",
  HIGH: "عالي",
  URGENT: "عاجل",
};

/**
 * Returns the inline CSS variables for a given tone — useful when you want
 * a one-shot style object instead of a class. Color tokens are defined in
 * `src/styles/tokens.css`.
 */
export function toneVars(tone: Tone): {
  background: string;
  color: string;
  borderColor: string;
} {
  return {
    background: `var(--tone-${tone}-bg)`,
    color: `var(--tone-${tone}-fg)`,
    borderColor: `var(--tone-${tone}-border)`,
  };
}

export function priorityColor(priority: Priority): string {
  switch (priority) {
    case "LOW":
      return "var(--priority-low)";
    case "MEDIUM":
      return "var(--priority-medium)";
    case "HIGH":
      return "var(--priority-high)";
    case "URGENT":
      return "var(--priority-urgent)";
  }
}
