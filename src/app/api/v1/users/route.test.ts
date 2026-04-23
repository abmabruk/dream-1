import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/http/http-error";
import {
  allowApiAccess,
  denyApiAccess,
  invalidJsonRequest,
  jsonRequest,
  readJson,
} from "@/test/api-route-test-helpers";

const mockRequireApiPermission = vi.hoisted(() => vi.fn());
const mockUserService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
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

import { GET, POST } from "./route";

describe("/api/v1/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current factory team list for authorized admins", async () => {
    const users = [{ id: "user_1", email: "owner@dream1.local" }];
    mockRequireApiPermission.mockResolvedValue(
      allowApiAccess({ role: "FACTORY_MANAGER" })
    );
    mockUserService.list.mockResolvedValue(users);

    const response = await GET();
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockUserService.list).toHaveBeenCalledWith("factory_1");
    expect(body).toEqual({
      ok: true,
      data: users,
    });
  });

  it("rejects invalid JSON bodies when creating a user", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());

    const response = await POST(invalidJsonRequest("POST"));
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Request body is required",
      },
    });
  });

  it("passes the actor and payload into the user service on create", async () => {
    const payload = {
      firstName: "Sara",
      lastName: "Lead",
      email: "sara@dream1.local",
      role: "SUPERVISOR",
      password: "dream12345",
    };
    const created = {
      id: "user_2",
      email: "sara@dream1.local",
    };
    mockRequireApiPermission.mockResolvedValue(
      allowApiAccess({ role: "FACTORY_MANAGER" })
    );
    mockUserService.create.mockResolvedValue(created);

    const response = await POST(jsonRequest("POST", payload));
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockUserService.create).toHaveBeenCalledWith(
      "factory_1",
      {
        userId: "user_1",
        role: "FACTORY_MANAGER",
      },
      payload
    );
    expect(response.status).toBe(201);
    expect(body).toEqual({
      ok: true,
      data: created,
    });
  });

  it("returns the shared auth response when management access is denied", async () => {
    mockRequireApiPermission.mockResolvedValue(denyApiAccess("Forbidden", 403));

    const response = await GET();
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Forbidden",
      },
    });
  });

  it("maps service conflicts into a 409 API response", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockUserService.create.mockRejectedValue(
      new HttpError(409, "A user with this email already exists.")
    );

    const response = await POST(
      jsonRequest("POST", {
        firstName: "Sara",
        lastName: "Lead",
        email: "sara@dream1.local",
        role: "SUPERVISOR",
        password: "dream12345",
      })
    );
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "A user with this email already exists.",
      },
    });
  });
});
