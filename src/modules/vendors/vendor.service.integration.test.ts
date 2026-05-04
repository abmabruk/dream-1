import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createIntegrationDatabase,
  disconnectGlobalPrisma,
  resetIntegrationDatabase,
} from "@/test/integration-db";

function isIntegrationDbAvailable(): boolean {
  if (!process.env.DATABASE_URL) return false;
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const describeVendor = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

type Actor = { userId: string; role: string };

type ServiceCtor = new () => {
  list: (
    factoryId: string,
    role: string,
    opts?: { search?: string; deletedFilter?: "active" | "deleted" | "all" },
  ) => Promise<Array<{ id: string; name: string; deletedAt: string | null }>>;
  getById: (
    factoryId: string,
    role: string,
    id: string,
  ) => Promise<{ id: string; name: string; city: string | null; contacts: unknown[] }>;
  create: (
    factoryId: string,
    actor: Actor,
    input: unknown,
  ) => Promise<{ id: string; name: string; normalizedName: string }>;
  update: (
    factoryId: string,
    actor: Actor,
    id: string,
    input: unknown,
  ) => Promise<{ id: string; city: string | null }>;
  softDelete: (factoryId: string, actor: Actor, id: string) => Promise<{ id: string }>;
  restore: (factoryId: string, actor: Actor, id: string) => Promise<{ id: string }>;
  addContact: (
    factoryId: string,
    actor: Actor,
    vendorId: string,
    input: unknown,
  ) => Promise<{ id: string; isPrimary: boolean }>;
  getPerformance: (
    factoryId: string,
    role: string,
    id: string,
  ) => Promise<{ totalSpend: string; costCount: number; lastUsedAt: string | null }>;
};

describeVendor("VendorService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let VendorService: ServiceCtor | undefined;
  let serviceLoadError: Error | undefined;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    try {
      const mod = (await import("./vendor.service")) as unknown as {
        VendorService: ServiceCtor;
      };
      VendorService = mod.VendorService;
    } catch (err) {
      serviceLoadError = err as Error;
    }
  }, 60_000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  function ensureService() {
    if (!VendorService) {
      throw new Error(
        `VendorService not available (Agent B may not have completed). Underlying: ${serviceLoadError?.message ?? "unknown"}`,
      );
    }
    return new VendorService();
  }

  async function makeFactory(suffix = "") {
    const factory = await prisma.factory.create({
      data: { name: `F${suffix}`, slug: `f${suffix || "0"}`, currency: "SAR" },
    });
    const owner = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: `owner${suffix}@f.local`,
        firstName: "Owner",
        lastName: "Person",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    return { factory, owner };
  }

  function ownerActor(userId: string): Actor {
    return { userId, role: "OWNER" };
  }

  it("create + getById round trip", async () => {
    const { factory, owner } = await makeFactory("a");
    const svc = ensureService();
    const created = await svc.create(factory.id, ownerActor(owner.id), {
      name: "Acme",
      city: "Riyadh",
    });
    const fetched = await svc.getById(factory.id, "OWNER", created.id);
    expect(fetched.name).toBe("Acme");
    expect(fetched.city).toBe("Riyadh");
  });

  it("rejects duplicate normalized name with 409", async () => {
    const { factory, owner } = await makeFactory("b");
    const svc = ensureService();
    await svc.create(factory.id, ownerActor(owner.id), { name: "Acme" });
    await expect(
      svc.create(factory.id, ownerActor(owner.id), { name: "Acme" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("dedups via normalizedName: 'ABC Corp' vs 'abc corp  '", async () => {
    const { factory, owner } = await makeFactory("c");
    const svc = ensureService();
    await svc.create(factory.id, ownerActor(owner.id), { name: "ABC Corp" });
    await expect(
      svc.create(factory.id, ownerActor(owner.id), { name: "abc corp  " }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("softDelete + restore", async () => {
    const { factory, owner } = await makeFactory("d");
    const svc = ensureService();
    const v = await svc.create(factory.id, ownerActor(owner.id), { name: "Acme" });
    await svc.softDelete(factory.id, ownerActor(owner.id), v.id);
    const afterDelete = await svc.getById(factory.id, "OWNER", v.id);
    expect((afterDelete as unknown as { deletedAt: string | null }).deletedAt).not.toBeNull();
    await svc.restore(factory.id, ownerActor(owner.id), v.id);
    const afterRestore = await svc.getById(factory.id, "OWNER", v.id);
    expect((afterRestore as unknown as { deletedAt: string | null }).deletedAt).toBeNull();
  });

  it("softDelete excludes from default list, included when deletedFilter='deleted'", async () => {
    const { factory, owner } = await makeFactory("e");
    const svc = ensureService();
    const v = await svc.create(factory.id, ownerActor(owner.id), { name: "Acme" });
    await svc.softDelete(factory.id, ownerActor(owner.id), v.id);

    const active = await svc.list(factory.id, "OWNER");
    expect(active.find((x) => x.id === v.id)).toBeUndefined();

    const deleted = await svc.list(factory.id, "OWNER", { deletedFilter: "deleted" });
    expect(deleted.find((x) => x.id === v.id)).toBeDefined();
  });

  it("cross-factory isolation", async () => {
    const a = await makeFactory("f1");
    const b = await makeFactory("f2");
    const svc = ensureService();
    const va = await svc.create(a.factory.id, ownerActor(a.owner.id), {
      name: "AcmeA",
    });

    await expect(svc.getById(b.factory.id, "OWNER", va.id)).rejects.toMatchObject({
      status: 404,
    });

    const bList = await svc.list(b.factory.id, "OWNER");
    expect(bList.find((x) => x.id === va.id)).toBeUndefined();
  });

  it("addContact stores fields including isPrimary", async () => {
    const { factory, owner } = await makeFactory("g");
    const svc = ensureService();
    const v = await svc.create(factory.id, ownerActor(owner.id), { name: "Acme" });
    const c = await svc.addContact(factory.id, ownerActor(owner.id), v.id, {
      name: "Ali",
      email: "ali@a.com",
      isPrimary: true,
    });
    expect(c.isPrimary).toBe(true);

    const c2 = await svc.addContact(factory.id, ownerActor(owner.id), v.id, {
      name: "Sara",
      isPrimary: true,
    });
    expect(c2.isPrimary).toBe(true);

    // After adding a second isPrimary, only one should remain primary if enforced;
    // otherwise both store true. Either is acceptable — assert state is queryable.
    const detail = await svc.getById(factory.id, "OWNER", v.id);
    const primaries = (
      detail.contacts as Array<{ isPrimary: boolean }>
    ).filter((c) => c.isPrimary);
    expect(primaries.length).toBeGreaterThanOrEqual(1);
  });

  it("update vendor partial (only city)", async () => {
    const { factory, owner } = await makeFactory("h");
    const svc = ensureService();
    const v = await svc.create(factory.id, ownerActor(owner.id), {
      name: "Acme",
      city: "Riyadh",
    });
    const updated = await svc.update(factory.id, ownerActor(owner.id), v.id, {
      city: "Jeddah",
    });
    expect(updated.city).toBe("Jeddah");
    const fetched = await svc.getById(factory.id, "OWNER", v.id);
    expect(fetched.name).toBe("Acme");
    expect(fetched.city).toBe("Jeddah");
  });

  it("getPerformance returns zeros for unused vendor", async () => {
    const { factory, owner } = await makeFactory("i");
    const svc = ensureService();
    const v = await svc.create(factory.id, ownerActor(owner.id), { name: "Acme" });
    const perf = await svc.getPerformance(factory.id, "OWNER", v.id);
    expect(Number(perf.totalSpend)).toBe(0);
    expect(perf.costCount).toBe(0);
    expect(perf.lastUsedAt).toBeNull();
  });

  it("SALES_MANAGER can view but not manage", async () => {
    const { factory, owner } = await makeFactory("j");
    const sales = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "sales@j.local",
        firstName: "Sales",
        lastName: "Mgr",
        role: "SALES_MANAGER",
        status: "ACTIVE",
      },
    });
    const svc = ensureService();
    const v = await svc.create(factory.id, ownerActor(owner.id), { name: "Acme" });

    // SALES_MANAGER can view
    const fetched = await svc.getById(factory.id, "SALES_MANAGER", v.id);
    expect(fetched.id).toBe(v.id);

    // SALES_MANAGER cannot manage
    await expect(
      svc.create(factory.id, { userId: sales.id, role: "SALES_MANAGER" }, {
        name: "Other",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
