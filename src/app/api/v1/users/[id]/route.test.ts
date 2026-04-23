import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  allowApiAccess,
  invalidJsonRequest,
  jsonRequest,
  readJson,
} from "@/test/api-route-test-helpers";

const mockRequireApiPermission = vi.hoisted(() => vi.fn());
const mockUserService = vi.hoisted(() => ({
  updateManagedUser: vi.fn(),
}));

vi.mock("@/modules/auth/api-guard", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/modules/users/user.service", () => ({
  UserService: class {
    constructor() {
      return mockUserService;
    }
  },
}));

import { PATCH } from "./route";

describe("/api/v1/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid JSON bodies before patching a user", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());

    const response = await PATCH(invalidJsonRequest("PATCH"), {
      params: Promise.resolve({ id: "user_2" }),
    });
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Request body is required",
      },
    });
  });

  it("maps the route param into the managed-user update payload", async () => {
    const updated = {
      id: "user_2",
      role: "SUPERVISOR",
      status: "ACTIVE",
    };
    mockRequireApiPermission.mockResolvedValue(
      allowApiAccess({ role: "FACTORY_MANAGER" })
    );
    mockUserService.updateManagedUser.mockResolvedValue(updated);

    const response = await PATCH(
      jsonRequest("PATCH", {
        role: "SUPERVISOR",
        status: "ACTIVE",
      }),
      {
        params: Promise.resolve({ id: "user_2" }),
      }
    );
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockUserService.updateManagedUser).toHaveBeenCalledWith(
      "factory_1",
      {
        userId: "user_1",
        role: "FACTORY_MANAGER",
      },
      {
        userId: "user_2",
        role: "SUPERVISOR",
        status: "ACTIVE",
      }
    );
    expect(body).toEqual({
      ok: true,
      data: updated,
    });
  });
});
