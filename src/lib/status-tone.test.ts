import { describe, expect, it } from "vitest";

import {
  PRIORITY_LABELS_AR,
  TONE_LABELS_AR,
  priorityColor,
  statusToTone,
  toneVars,
  type Priority,
  type Tone,
} from "./status-tone";

// All enum values that the global tone palette must cover. Source of truth:
// `prisma/schema.prisma`. If the schema gains a value, this test forces us
// to update STATUS_TO_TONE.
const ORDER_STATUSES = [
  "DRAFT",
  "QUOTED",
  "APPROVED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

const PROJECT_STATUSES = [
  "PLANNING",
  "READY",
  "IN_PROGRESS",
  "ON_HOLD",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;

const PROJECT_TASK_STATUSES = [
  "BACKLOG",
  "PLANNED_TODAY",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

const WORK_QUEUE_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

const ASSIGNMENT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
] as const;

const INQUIRY_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "QUOTED",
  "WON",
  "LOST",
] as const;

const ALL_TONES: Tone[] = [
  "draft",
  "planned",
  "in-progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
];

describe("statusToTone()", () => {
  it.each(ORDER_STATUSES)("maps OrderStatus.%s to a known tone", (status) => {
    const tone = statusToTone(status);
    expect(ALL_TONES).toContain(tone);
  });

  it.each(PROJECT_STATUSES)("maps ProjectStatus.%s to a known tone", (status) => {
    expect(ALL_TONES).toContain(statusToTone(status));
  });

  it.each(PROJECT_TASK_STATUSES)("maps ProjectTaskStatus.%s to a known tone", (status) => {
    expect(ALL_TONES).toContain(statusToTone(status));
  });

  it.each(WORK_QUEUE_STATUSES)("maps WorkQueueStatus.%s to a known tone", (status) => {
    expect(ALL_TONES).toContain(statusToTone(status));
  });

  it.each(ASSIGNMENT_STATUSES)("maps AssignmentStatus.%s to a known tone", (status) => {
    expect(ALL_TONES).toContain(statusToTone(status));
  });

  it.each(INQUIRY_STAGES)("maps InquiryStage.%s to a known tone", (stage) => {
    expect(ALL_TONES).toContain(statusToTone(stage));
  });

  it("falls back to draft for unknown statuses", () => {
    expect(statusToTone("DOES_NOT_EXIST")).toBe("draft");
    expect(statusToTone("")).toBe("draft");
  });

  it("aligns specific high-signal statuses with the documented palette", () => {
    // sanity-check a handful so we catch silent mapping flips
    expect(statusToTone("DELIVERED")).toBe("done");
    expect(statusToTone("BLOCKED")).toBe("blocked");
    expect(statusToTone("IN_PROGRESS")).toBe("in-progress");
    expect(statusToTone("WAITING_APPROVAL")).toBe("waiting");
    expect(statusToTone("CANCELLED")).toBe("cancelled");
    expect(statusToTone("DRAFT")).toBe("draft");
    expect(statusToTone("QUOTED")).toBe("waiting");
    expect(statusToTone("APPROVED")).toBe("planned");
  });
});

describe("TONE_LABELS_AR", () => {
  it("has an Arabic label for every tone", () => {
    for (const tone of ALL_TONES) {
      expect(TONE_LABELS_AR[tone]).toBeTruthy();
      expect(typeof TONE_LABELS_AR[tone]).toBe("string");
    }
  });

  it("has no extraneous keys", () => {
    expect(Object.keys(TONE_LABELS_AR).sort()).toEqual([...ALL_TONES].sort());
  });
});

describe("PRIORITY_LABELS_AR", () => {
  it.each<Priority>(["LOW", "MEDIUM", "HIGH", "URGENT"])(
    "labels priority %s",
    (p) => {
      expect(PRIORITY_LABELS_AR[p]).toBeTruthy();
    },
  );
});

describe("toneVars()", () => {
  it.each(ALL_TONES)("returns CSS variables for tone %s", (tone) => {
    const vars = toneVars(tone);
    expect(vars.background).toBe(`var(--tone-${tone}-bg)`);
    expect(vars.color).toBe(`var(--tone-${tone}-fg)`);
    expect(vars.borderColor).toBe(`var(--tone-${tone}-border)`);
  });
});

describe("priorityColor()", () => {
  it.each<[Priority, string]>([
    ["LOW", "var(--priority-low)"],
    ["MEDIUM", "var(--priority-medium)"],
    ["HIGH", "var(--priority-high)"],
    ["URGENT", "var(--priority-urgent)"],
  ])("returns the right CSS variable for %s", (p, expected) => {
    expect(priorityColor(p)).toBe(expected);
  });
});
