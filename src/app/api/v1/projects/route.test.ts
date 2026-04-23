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
const mockProjectService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
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

import { GET, POST } from "./route";

describe("/api/v1/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists projects for the current factory", async () => {
    const projects = [{ id: "project_1", code: "PRJ-00001" }];
    mockRequireApiPermission.mockResolvedValue(allowApiAccess({ role: "SUPERVISOR" }));
    mockProjectService.list.mockResolvedValue(projects);

    const response = await GET(new Request("http://localhost/test?date=2026-04-23"));
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockProjectService.list).toHaveBeenCalledWith("factory_1", "2026-04-23");
    expect(body).toEqual({
      ok: true,
      data: projects,
    });
  });

  it("returns the auth response when create access is denied", async () => {
    mockRequireApiPermission.mockResolvedValue(denyApiAccess("Forbidden", 403));

    const response = await POST(jsonRequest("POST", { name: "Launch board" }));
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Forbidden",
      },
    });
  });

  it("rejects invalid JSON bodies on create", async () => {
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

  it("creates a project and returns 201", async () => {
    const payload = { name: "Launch board", priority: "HIGH" };
    const created = { id: "project_1", code: "PRJ-00001" };
    mockRequireApiPermission.mockResolvedValue(allowApiAccess({ role: "FACTORY_MANAGER" }));
    mockProjectService.create.mockResolvedValue(created);

    const response = await POST(jsonRequest("POST", payload));
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockProjectService.create).toHaveBeenCalledWith("factory_1", "user_1", payload);
    expect(response.status).toBe(201);
    expect(body).toEqual({
      ok: true,
      data: created,
    });
  });

  it("maps project service conflicts into API responses", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockProjectService.create.mockRejectedValue(new HttpError(409, "Project code already exists."));

    const response = await POST(jsonRequest("POST", { name: "Launch board" }));
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Project code already exists.",
      },
    });
  });
});
