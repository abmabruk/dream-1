import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  allowApiAccess,
  denyApiAccess,
  invalidJsonRequest,
  jsonRequest,
  readJson,
} from "@/test/api-route-test-helpers";

const mockRequireApiPermission = vi.hoisted(() => vi.fn());
const mockOrderService = vi.hoisted(() => ({
  updateStatus: vi.fn(),
}));

vi.mock("@/modules/auth/api-guard", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/modules/orders/order.service", () => ({
  OrderService: class {
    constructor() {
      return mockOrderService;
    }
  },
}));

import { POST } from "./route";

describe("/api/v1/orders/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth error response when updates are forbidden", async () => {
    mockRequireApiPermission.mockResolvedValue(denyApiAccess("Forbidden", 403));

    const response = await POST(jsonRequest("POST", { status: "APPROVED" }), {
      params: Promise.resolve({ id: "order_1" }),
    });
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Forbidden",
      },
    });
    expect(mockOrderService.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON bodies before updating status", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());

    const response = await POST(invalidJsonRequest("POST"), {
      params: Promise.resolve({ id: "order_1" }),
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

  it("passes the route param and body into the order workflow service", async () => {
    const updated = {
      id: "order_1",
      status: "APPROVED",
    };
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockOrderService.updateStatus.mockResolvedValue(updated);

    const response = await POST(
      jsonRequest("POST", {
        status: "APPROVED",
        note: "Customer confirmed by phone",
      }),
      {
        params: Promise.resolve({ id: "order_1" }),
      }
    );
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(mockOrderService.updateStatus).toHaveBeenCalledWith(
      "factory_1",
      "user_1",
      {
        orderId: "order_1",
        status: "APPROVED",
        note: "Customer confirmed by phone",
      }
    );
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: updated,
    });
  });
});
