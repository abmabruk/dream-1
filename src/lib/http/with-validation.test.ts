import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ok } from "./api-response";

const fakeSession = {
  userId: "u1",
  factoryId: "f1",
  factoryName: "Acme",
  factoryCurrency: "USD",
  factoryTimezone: "UTC",
  role: "OWNER" as const,
  email: "owner@acme.test",
  displayName: "Owner",
};

vi.mock("@/modules/auth/api-guard", () => ({
  requireApiPermission: vi.fn(async () => ({
    ok: true as const,
    session: fakeSession,
  })),
}));

import { defineRoute } from "./with-validation";

function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown } = {},
) {
  return new Request(url, {
    method: init.method ?? "POST",
    headers: { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe("defineRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is missing/invalid JSON", async () => {
    const handler = vi.fn();
    const route = defineRoute({
      permission: "costs:manage",
      body: z.object({ name: z.string() }),
      handler,
    });

    const req = new Request("http://test.local/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const res = await route(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(json.ok).toBe(false);
    expect(json.error.message).toMatch(/valid JSON/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 400 with descriptive message for invalid body schema", async () => {
    const handler = vi.fn();
    const route = defineRoute({
      permission: "costs:manage",
      body: z.object({ name: z.string().min(2), qty: z.number() }),
      handler,
    });

    const res = await route(
      jsonRequest("http://test.local/api/x", { body: { name: "a" } }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toMatch(/Invalid request body/);
    expect(json.error.message).toMatch(/qty/);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with parsed body, params, and session", async () => {
    const handler = vi.fn(async () => ok({ created: true }, { status: 201 }));
    const route = defineRoute({
      permission: "costs:manage",
      params: z.object({ id: z.string().min(1) }),
      body: z.object({ name: z.string(), qty: z.number() }),
      handler,
    });

    const res = await route(
      jsonRequest("http://test.local/api/projects/p1/costs", {
        body: { name: "Steel", qty: 3 },
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
    const ctx = (handler.mock.calls as unknown as Array<unknown[]>)[0]![0] as {
      session: typeof fakeSession;
      params: { id: string };
      body: { name: string; qty: number };
    };
    expect(ctx.session.factoryId).toBe("f1");
    expect(ctx.params).toEqual({ id: "p1" });
    expect(ctx.body).toEqual({ name: "Steel", qty: 3 });
  });

  it("supports repeated query keys collapsing to arrays", async () => {
    const handler = vi.fn(async (ctx) =>
      ok({ cats: (ctx as { query: { cat: string[] } }).query.cat }),
    );
    const route = defineRoute({
      permission: "costs:view",
      query: z.object({
        cat: z.union([z.string(), z.array(z.string())]),
        limit: z.string().optional(),
      }),
      handler,
    });

    const req = new Request("http://test.local/api/x?cat=A&cat=B&limit=10", {
      method: "GET",
    });
    const res = await route(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const ctx = (handler.mock.calls as unknown as Array<unknown[]>)[0]![0] as {
      query: { cat: string[]; limit?: string };
    };
    expect(ctx.query.cat).toEqual(["A", "B"]);
    expect(ctx.query.limit).toBe("10");
  });

  it("returns 401 when permission check fails", async () => {
    const guard = await import("@/modules/auth/api-guard");
    (guard.requireApiPermission as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false as const,
        response: new Response(
          JSON.stringify({ ok: false, error: { message: "Authentication required" } }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      });

    const handler = vi.fn();
    const route = defineRoute({
      permission: "costs:manage",
      body: z.object({ name: z.string() }),
      handler,
    });

    const res = await route(
      jsonRequest("http://test.local/api/x", { body: { name: "x" } }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
