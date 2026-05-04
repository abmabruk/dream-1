import { describe, expect, it } from "vitest";

import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TRANSITIONS,
  ASSIGNMENT_STATUS_VALUES,
  type AssignmentWorkflowStatus,
} from "./assignment-status";
import {
  assignmentStatusSchema,
  createAssignmentSchema,
  updateAssignmentStatusSchema,
} from "./assignment.schemas";

const base = {
  orderId: "ord_1",
  workerId: "usr_1",
  station: "CUTTING",
};

describe("createAssignmentSchema", () => {
  it("accepts a minimal valid assignment", () => {
    expect(createAssignmentSchema.safeParse(base).success).toBe(true);
  });

  it("rejects empty orderId", () => {
    expect(
      createAssignmentSchema.safeParse({ ...base, orderId: "" }).success,
    ).toBe(false);
  });

  it("rejects empty workerId", () => {
    expect(
      createAssignmentSchema.safeParse({ ...base, workerId: "" }).success,
    ).toBe(false);
  });

  it("rejects station shorter than 2 chars", () => {
    expect(
      createAssignmentSchema.safeParse({ ...base, station: "A" }).success,
    ).toBe(false);
  });

  it("rejects station longer than 100 chars", () => {
    expect(
      createAssignmentSchema.safeParse({ ...base, station: "x".repeat(101) })
        .success,
    ).toBe(false);
  });

  it("rejects notes longer than 1000 chars", () => {
    expect(
      createAssignmentSchema.safeParse({ ...base, notes: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });

  it("accepts optional scheduledFor and notes", () => {
    expect(
      createAssignmentSchema.safeParse({
        ...base,
        scheduledFor: "2026-06-01T08:00:00.000Z",
        notes: "ابدأ الصباح",
      }).success,
    ).toBe(true);
  });
});

describe("updateAssignmentStatusSchema", () => {
  it("accepts valid status update", () => {
    expect(
      updateAssignmentStatusSchema.safeParse({
        assignmentId: "asg_1",
        status: "IN_PROGRESS",
      }).success,
    ).toBe(true);
  });

  it("rejects empty assignmentId", () => {
    expect(
      updateAssignmentStatusSchema.safeParse({
        assignmentId: "",
        status: "DONE",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown status", () => {
    expect(
      updateAssignmentStatusSchema.safeParse({
        assignmentId: "asg_1",
        status: "WAT",
      }).success,
    ).toBe(false);
  });
});

describe("assignmentStatusSchema enum", () => {
  it.each(ASSIGNMENT_STATUS_VALUES)("accepts %s", (s) => {
    expect(assignmentStatusSchema.safeParse(s).success).toBe(true);
  });

  it("has labels for all statuses", () => {
    for (const s of ASSIGNMENT_STATUS_VALUES) {
      expect(ASSIGNMENT_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

describe("ASSIGNMENT_STATUS_TRANSITIONS state machine", () => {
  function canTransition(
    from: AssignmentWorkflowStatus,
    to: AssignmentWorkflowStatus,
  ): boolean {
    return ASSIGNMENT_STATUS_TRANSITIONS[from].includes(to);
  }

  it("allows the happy path PLANNED → IN_PROGRESS → DONE", () => {
    expect(canTransition("PLANNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DONE")).toBe(true);
  });

  it("allows PLANNED → BLOCKED and IN_PROGRESS → BLOCKED", () => {
    expect(canTransition("PLANNED", "BLOCKED")).toBe(true);
    expect(canTransition("IN_PROGRESS", "BLOCKED")).toBe(true);
  });

  it("does NOT allow direct PLANNED → DONE (must pass through IN_PROGRESS)", () => {
    expect(canTransition("PLANNED", "DONE")).toBe(false);
  });

  it("allows BLOCKED → IN_PROGRESS and BLOCKED → DONE (recovery)", () => {
    expect(canTransition("BLOCKED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("BLOCKED", "DONE")).toBe(true);
  });

  it("does NOT allow re-blocking from DONE (terminal)", () => {
    expect(ASSIGNMENT_STATUS_TRANSITIONS.DONE).toEqual([]);
  });

  it("rejects no-op self transitions", () => {
    for (const s of ASSIGNMENT_STATUS_VALUES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("rejects backward transition IN_PROGRESS → PLANNED", () => {
    expect(canTransition("IN_PROGRESS", "PLANNED")).toBe(false);
  });
});
