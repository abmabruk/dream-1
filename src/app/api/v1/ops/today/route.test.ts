import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  allowApiAccess,
  denyApiAccess,
  readJson,
} from "@/test/api-route-test-helpers";

const mockRequireApiPermission = vi.hoisted(() => vi.fn());
const mockProjectService = vi.hoisted(() => ({
  getOpsBoard: vi.fn(),
}));

vi.mock("@/modules/auth/api-guard", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/modules/projects/project.service", () => ({
  ProjectService: class {
    constructor() {
      return mockProjectService;
    }
  },
}));

import { GET } from "./route";

describe("/api/v1/ops/today", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when ops access is denied", async () => {
    mockRequireApiPermission.mockResolvedValue(denyApiAccess("Forbidden", 403));

    const response = await GET(new Request("http://localhost/test"));
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Forbidden",
      },
    });
  });

  it("returns the board for the requested date", async () => {
    const board = {
      date: "2026-04-23",
      summary: { total: 0, overdue: 0, waitingApproval: 0, blocked: 0, done: 0 },
      queue: [],
      projects: [],
      forgottenTasks: [],
    };
    mockRequireApiPermission.mockResolvedValue(allowApiAccess({ role: "SUPERVISOR" }));
    mockProjectService.getOpsBoard.mockResolvedValue(board);

    const response = await GET(new Request("http://localhost/test?date=2026-04-23"));
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockProjectService.getOpsBoard).toHaveBeenCalledWith("factory_1", {
      date: "2026-04-23",
    });
    expect(body).toEqual({
      ok: true,
      data: board,
    });
  });
});
