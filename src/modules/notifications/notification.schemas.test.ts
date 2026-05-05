import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_STATUS_VALUES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_VALUES,
  notificationDraftSchema,
  notificationFeedSchema,
} from "./notification.schemas";

const baseDraft = {
  dedupeKey: "order:1:overdue",
  type: "ORDER_OVERDUE" as const,
  title: "الطلب متأخر",
  message: "تجاوز الطلب الموعد المحدد",
};

describe("notificationDraftSchema", () => {
  it("accepts a minimal valid draft", () => {
    expect(notificationDraftSchema.safeParse(baseDraft).success).toBe(true);
  });

  it("rejects empty dedupeKey", () => {
    expect(
      notificationDraftSchema.safeParse({ ...baseDraft, dedupeKey: "" })
        .success,
    ).toBe(false);
  });

  it("rejects empty title", () => {
    expect(
      notificationDraftSchema.safeParse({ ...baseDraft, title: "" }).success,
    ).toBe(false);
  });

  it("rejects title longer than 160 chars", () => {
    expect(
      notificationDraftSchema.safeParse({
        ...baseDraft,
        title: "x".repeat(161),
      }).success,
    ).toBe(false);
  });

  it("rejects empty message", () => {
    expect(
      notificationDraftSchema.safeParse({ ...baseDraft, message: "" }).success,
    ).toBe(false);
  });

  it("rejects message longer than 280 chars", () => {
    expect(
      notificationDraftSchema.safeParse({
        ...baseDraft,
        message: "x".repeat(281),
      }).success,
    ).toBe(false);
  });

  it("rejects unknown type", () => {
    expect(
      notificationDraftSchema.safeParse({ ...baseDraft, type: "WHO_KNOWS" })
        .success,
    ).toBe(false);
  });

  it("accepts all known notification types", () => {
    for (const t of NOTIFICATION_TYPE_VALUES) {
      expect(
        notificationDraftSchema.safeParse({ ...baseDraft, type: t }).success,
      ).toBe(true);
    }
  });

  it("accepts optional href / entityType / entityId", () => {
    expect(
      notificationDraftSchema.safeParse({
        ...baseDraft,
        href: "/orders/1",
        entityType: "Order",
        entityId: "1",
      }).success,
    ).toBe(true);
  });
});

describe("NOTIFICATION_TYPE_LABELS", () => {
  it("has an Arabic label for every type", () => {
    for (const t of NOTIFICATION_TYPE_VALUES) {
      expect(NOTIFICATION_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});

describe("notificationFeedSchema", () => {
  it("accepts a valid empty feed", () => {
    const r = notificationFeedSchema.safeParse({
      summary: {
        totalActive: 0,
        unread: 0,
        read: 0,
        overdueOrders: 0,
        dueFollowUps: 0,
        blockedAssignments: 0,
        pendingApprovals: 0,
      },
      unread: [],
      read: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative summary counts", () => {
    const r = notificationFeedSchema.safeParse({
      summary: {
        totalActive: -1,
        unread: 0,
        read: 0,
        overdueOrders: 0,
        dueFollowUps: 0,
        blockedAssignments: 0,
        pendingApprovals: 0,
      },
      unread: [],
      read: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("NOTIFICATION_STATUS_VALUES", () => {
  it("contains exactly UNREAD and READ", () => {
    expect([...NOTIFICATION_STATUS_VALUES].sort()).toEqual(["READ", "UNREAD"]);
  });
});
