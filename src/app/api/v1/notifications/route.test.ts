import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/http/http-error";
import {
  allowApiAccess,
  denyApiAccess,
  jsonRequest,
  readJson,
} from "@/test/api-route-test-helpers";

const mockRequireApiPermission = vi.hoisted(() => vi.fn());
const mockNotificationService = vi.hoisted(() => ({
  getFeed: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

vi.mock("@/modules/auth/api-guard", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/modules/notifications/notification.service", () => ({
  NotificationService: class {
    constructor() {
      return mockNotificationService;
    }
  },
}));

import { GET } from "./route";
import { POST as markRead } from "./[id]/read/route";
import { POST as markAllRead } from "./read-all/route";

describe("/api/v1/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the notification feed for the signed-in account", async () => {
    const feed = {
      summary: {
        totalActive: 2,
        unread: 1,
        read: 1,
        overdueOrders: 1,
        dueFollowUps: 0,
        blockedAssignments: 1,
        pendingApprovals: 0,
      },
      unread: [{ id: "note_1" }],
      read: [{ id: "note_2" }],
    };
    mockRequireApiPermission.mockResolvedValue(
      allowApiAccess({ role: "FACTORY_MANAGER" })
    );
    mockNotificationService.getFeed.mockResolvedValue(feed);

    const response = await GET();
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockNotificationService.getFeed).toHaveBeenCalledWith({
      factoryId: "factory_1",
      userId: "user_1",
      role: "FACTORY_MANAGER",
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: feed,
    });
  });

  it("returns the auth response when notification access is denied", async () => {
    mockRequireApiPermission.mockResolvedValue(denyApiAccess());

    const response = await GET();
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Authentication required",
      },
    });
  });

  it("marks a single notification as read using the route param id", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());

    const response = await markRead(jsonRequest("POST"), {
      params: Promise.resolve({ id: "note_1" }),
    });
    const body = await readJson<{ ok: true; data: { id: string } }>(response);

    expect(mockNotificationService.markRead).toHaveBeenCalledWith(
      "factory_1",
      "user_1",
      "note_1"
    );
    expect(body).toEqual({
      ok: true,
      data: {
        id: "note_1",
      },
    });
  });

  it("marks all notifications as read for the current user", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockNotificationService.markAllRead.mockResolvedValue({ count: 3 });

    const response = await markAllRead();
    const body = await readJson<{ ok: true; data: { count: number } }>(response);

    expect(mockNotificationService.markAllRead).toHaveBeenCalledWith(
      "factory_1",
      "user_1"
    );
    expect(body).toEqual({
      ok: true,
      data: {
        count: 3,
      },
    });
  });

  it("maps domain errors for single-notification updates", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockNotificationService.markRead.mockRejectedValue(
      new HttpError(404, "Notification not found.")
    );

    const response = await markRead(jsonRequest("POST"), {
      params: Promise.resolve({ id: "note_404" }),
    });
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Notification not found.",
      },
    });
  });
});
