import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkQueueStatus } from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import { ProjectService } from "./project.service";
import { WORK_QUEUE_STATUS_TRANSITIONS } from "./project-status";

// ---------------------------------------------------------------------------
// State-machine transition map tests
// These test WORK_QUEUE_STATUS_TRANSITIONS exported from project-status.ts.
// ---------------------------------------------------------------------------

describe("WORK_QUEUE_STATUS_TRANSITIONS (state machine map)", () => {
  it("allows PLANNED → IN_PROGRESS", () => {
    expect(WORK_QUEUE_STATUS_TRANSITIONS[WorkQueueStatus.PLANNED]).toContain(WorkQueueStatus.IN_PROGRESS);
  });

  it("allows IN_PROGRESS → DONE", () => {
    expect(WORK_QUEUE_STATUS_TRANSITIONS[WorkQueueStatus.IN_PROGRESS]).toContain(WorkQueueStatus.DONE);
  });

  it("does NOT allow DONE → PLANNED (terminal state)", () => {
    expect(WORK_QUEUE_STATUS_TRANSITIONS[WorkQueueStatus.DONE]).not.toContain(WorkQueueStatus.PLANNED);
  });

  it("does NOT allow CANCELLED → IN_PROGRESS (terminal state)", () => {
    expect(WORK_QUEUE_STATUS_TRANSITIONS[WorkQueueStatus.CANCELLED]).not.toContain(WorkQueueStatus.IN_PROGRESS);
  });
});

// ---------------------------------------------------------------------------
// Service-level guard tests for updateQueueItem
// These test the requiresApproval / WAITING_APPROVAL business rules in
// project.service.ts, using mocked repositories and db.
// ---------------------------------------------------------------------------

const { mockUpdateQueueItem } = vi.hoisted(() => ({
  mockUpdateQueueItem: vi.fn(),
}));

vi.mock("./project.repository", () => ({
  ProjectRepository: class {
    updateQueueItem = mockUpdateQueueItem;
  },
}));

vi.mock("@/modules/orders/order.repository", () => ({
  OrderRepository: class {},
}));

vi.mock("@/modules/users/user.repository", () => ({
  UserRepository: class {},
}));

// The approval/transition guard now lives inside the repository. These tests
// verify that the service correctly delegates to the repository and propagates
// errors thrown by it — the guard logic itself is tested via integration tests.
describe("ProjectService.updateQueueItem — delegates to repository", () => {
  let service: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService();
  });

  it("delegates to repository and returns its result", async () => {
    mockUpdateQueueItem.mockResolvedValue({ id: "qi-1", status: WorkQueueStatus.WAITING_APPROVAL });

    const result = await service.updateQueueItem("factory-1", "worker-1", {
      queueItemId: "qi-1",
      status: "WAITING_APPROVAL",
    });

    expect(mockUpdateQueueItem).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "qi-1" });
  });

  it("propagates repository approval errors", async () => {
    mockUpdateQueueItem.mockRejectedValue(
      new HttpError(409, "This task requires approval before it can be marked done.")
    );

    await expect(
      service.updateQueueItem("factory-1", "worker-1", {
        queueItemId: "qi-2",
        status: "DONE",
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});
