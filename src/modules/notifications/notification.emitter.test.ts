import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the db module so importing the emitter never touches a real PrismaClient.
const upsert = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    notification: { upsert: (...args: unknown[]) => upsert(...args) },
    user: { findMany: (...args: unknown[]) => findMany(...args) },
  },
}));

import {
  emitNotification,
  emitNotifications,
  findFactoryUsersByRole,
  type EmitNotificationInput,
} from "./notification.emitter";

const baseInput: EmitNotificationInput = {
  factoryId: "f1",
  userId: "u1",
  type: "ORDER_OVERDUE",
  dedupeKey: "order:1:overdue",
  title: "متأخر",
  message: "تجاوز الموعد",
};

beforeEach(() => {
  upsert.mockReset();
  findMany.mockReset();
});

describe("emitNotification", () => {
  it("calls notification.upsert with where/create/update payloads", async () => {
    upsert.mockResolvedValue({ id: "n1" });
    await emitNotification(baseInput);
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({
      userId_dedupeKey: { userId: "u1", dedupeKey: "order:1:overdue" },
    });
    expect(arg.create.factoryId).toBe("f1");
    expect(arg.create.type).toBe("ORDER_OVERDUE");
    expect(arg.update.resolvedAt).toBeNull();
  });

  it("swallows errors and does not throw", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    upsert.mockRejectedValue(new Error("boom"));
    await expect(emitNotification(baseInput)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("uses the supplied tx client instead of the default db", async () => {
    const txUpsert = vi.fn().mockResolvedValue({ id: "n2" });
    const tx = {
      notification: { upsert: txUpsert },
      user: { findMany: vi.fn() },
    } as unknown as Parameters<typeof emitNotification>[1];

    await emitNotification(baseInput, tx);
    expect(txUpsert).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("calling twice with the same dedupeKey upserts twice (idempotent path)", async () => {
    upsert.mockResolvedValue({ id: "n1" });
    await emitNotification(baseInput);
    await emitNotification(baseInput);
    expect(upsert).toHaveBeenCalledTimes(2);
    // Both calls must hit the same composite key.
    for (const call of upsert.mock.calls) {
      expect(call[0].where.userId_dedupeKey.dedupeKey).toBe("order:1:overdue");
    }
  });
});

describe("emitNotifications", () => {
  it("iterates the array and calls upsert per item", async () => {
    upsert.mockResolvedValue({ id: "n" });
    await emitNotifications([
      baseInput,
      { ...baseInput, userId: "u2", dedupeKey: "order:1:overdue:u2" },
      { ...baseInput, userId: "u3", dedupeKey: "order:1:overdue:u3" },
    ]);
    expect(upsert).toHaveBeenCalledTimes(3);
  });

  it("does not throw even if every emit fails", async () => {
    upsert.mockRejectedValue(new Error("nope"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      emitNotifications([baseInput, { ...baseInput, userId: "u2" }]),
    ).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});

describe("findFactoryUsersByRole", () => {
  it("returns the rows from prisma with the expected shape and filters", async () => {
    findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    const rows = await findFactoryUsersByRole("f1", "OWNER");
    expect(rows).toEqual([{ id: "u1" }, { id: "u2" }]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg).toEqual({
      where: {
        factoryId: "f1",
        status: "ACTIVE",
        role: { in: ["OWNER"] },
      },
      select: { id: true },
    });
  });

  it("normalizes a single role into an array", async () => {
    findMany.mockResolvedValue([]);
    await findFactoryUsersByRole("f1", "FACTORY_MANAGER");
    expect(findMany.mock.calls[0][0].where.role).toEqual({
      in: ["FACTORY_MANAGER"],
    });
  });

  it("passes through an array of roles", async () => {
    findMany.mockResolvedValue([]);
    await findFactoryUsersByRole("f1", ["OWNER", "FACTORY_MANAGER"]);
    expect(findMany.mock.calls[0][0].where.role).toEqual({
      in: ["OWNER", "FACTORY_MANAGER"],
    });
  });

  it("uses the supplied tx client when provided", async () => {
    const txFindMany = vi.fn().mockResolvedValue([{ id: "uX" }]);
    const tx = {
      notification: { upsert: vi.fn() },
      user: { findMany: txFindMany },
    } as unknown as Parameters<typeof findFactoryUsersByRole>[2];

    const rows = await findFactoryUsersByRole("f1", "OWNER", tx);
    expect(rows).toEqual([{ id: "uX" }]);
    expect(txFindMany).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
  });
});
