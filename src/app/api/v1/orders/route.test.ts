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
const mockOrderService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
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

import { GET, POST } from "./route";

describe("/api/v1/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when the caller lacks permission", async () => {
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
    expect(mockOrderService.list).not.toHaveBeenCalled();
  });

  it("lists orders for the signed-in factory", async () => {
    const orders = [{ id: "order_1", code: "DRM-00001" }];
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockOrderService.list.mockResolvedValue(orders);

    const response = await GET();
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(response.status).toBe(200);
    expect(mockOrderService.list).toHaveBeenCalledWith("factory_1");
    expect(body).toEqual({
      ok: true,
      data: orders,
    });
  });

  it("rejects invalid JSON bodies before calling the service", async () => {
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
    expect(mockOrderService.create).not.toHaveBeenCalled();
  });

  it("creates an order and returns 201 for valid requests", async () => {
    const payload = {
      customerId: "customer_1",
      title: "VIP abaya",
      quotedAmount: 2400,
    };
    const created = {
      id: "order_1",
      code: "DRM-00001",
    };
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockOrderService.create.mockResolvedValue(created);

    const response = await POST(jsonRequest("POST", payload));
    const body = await readJson<{ ok: true; data: unknown }>(response);

    expect(response.status).toBe(201);
    expect(mockOrderService.create).toHaveBeenCalledWith(
      "factory_1",
      "user_1",
      payload
    );
    expect(body).toEqual({
      ok: true,
      data: created,
    });
  });

  it("maps domain errors into the shared API error shape", async () => {
    mockRequireApiPermission.mockResolvedValue(allowApiAccess());
    mockOrderService.create.mockRejectedValue(
      new HttpError(409, "Order code already exists.")
    );

    const response = await POST(
      jsonRequest("POST", {
        customerId: "customer_1",
        title: "VIP abaya",
      })
    );
    const body = await readJson<{ ok: false; error: { message: string } }>(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: {
        message: "Order code already exists.",
      },
    });
  });
});
