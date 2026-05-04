import { execFileSync } from "node:child_process";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

const describeProduct = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

type Actor = { userId: string; role: string };

type ServiceCtor = new () => {
  list: (
    factoryId: string,
    role: string,
    opts?: { search?: string; deletedFilter?: "active" | "deleted" | "all" },
  ) => Promise<Array<{ id: string; code: string; deletedAt: string | null }>>;
  getById: (
    factoryId: string,
    role: string,
    id: string,
  ) => Promise<{
    id: string;
    code: string;
    name: string;
    variants: Array<{ id: string; code: string; unitPriceDelta: string }>;
  }>;
  create: (
    factoryId: string,
    actor: Actor,
    input: unknown,
  ) => Promise<{ id: string; code: string; variants: unknown[] }>;
  softDelete: (
    factoryId: string,
    actor: Actor,
    id: string,
  ) => Promise<{ id: string }>;
  updateVariant: (
    factoryId: string,
    actor: Actor,
    productId: string,
    variantId: string,
    input: unknown,
  ) => Promise<{ id: string; unitPriceDelta: string }>;
  searchForPicker: (
    factoryId: string,
    role: string,
    query: string,
    limit?: number,
  ) => Promise<Array<{ id: string; code: string; name: string }>>;
};

describeProduct("ProductService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let ProductService: ServiceCtor | undefined;
  let serviceLoadError: Error | undefined;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    try {
      const mod = (await import("./product.service")) as unknown as {
        ProductService: ServiceCtor;
      };
      ProductService = mod.ProductService;
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
    if (!ProductService) {
      throw new Error(
        `ProductService not available (Agent C may not have completed). Underlying: ${serviceLoadError?.message ?? "unknown"}`,
      );
    }
    return new ProductService();
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

  it("create + getById", async () => {
    const { factory, owner } = await makeFactory("a");
    const svc = ensureService();
    const created = await svc.create(factory.id, ownerActor(owner.id), {
      code: "P-1",
      name: "Marble Tile",
      defaultUnitPrice: 100,
    });
    const fetched = await svc.getById(factory.id, "OWNER", created.id);
    expect(fetched.code).toBe("P-1");
    expect(fetched.name).toBe("Marble Tile");
  });

  it("rejects duplicate code with 409", async () => {
    const { factory, owner } = await makeFactory("b");
    const svc = ensureService();
    await svc.create(factory.id, ownerActor(owner.id), {
      code: "P-1",
      name: "First",
      defaultUnitPrice: 50,
    });
    await expect(
      svc.create(factory.id, ownerActor(owner.id), {
        code: "P-1",
        name: "Second",
        defaultUnitPrice: 60,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("create with variants — variants present in detail", async () => {
    const { factory, owner } = await makeFactory("c");
    const svc = ensureService();
    const created = await svc.create(factory.id, ownerActor(owner.id), {
      code: "P-2",
      name: "Multi",
      defaultUnitPrice: 100,
      variants: [
        { code: "V1", name: "White", unitPriceDelta: 0 },
        { code: "V2", name: "Black", unitPriceDelta: 5 },
      ],
    });
    const detail = await svc.getById(factory.id, "OWNER", created.id);
    expect(detail.variants.length).toBe(2);
    const codes = detail.variants.map((v) => v.code).sort();
    expect(codes).toEqual(["V1", "V2"]);
  });

  it("updateVariant changes unitPriceDelta", async () => {
    const { factory, owner } = await makeFactory("d");
    const svc = ensureService();
    const created = await svc.create(factory.id, ownerActor(owner.id), {
      code: "P-3",
      name: "Tile",
      defaultUnitPrice: 100,
      variants: [{ code: "V1", name: "White", unitPriceDelta: 0 }],
    });
    const detail = await svc.getById(factory.id, "OWNER", created.id);
    const variantId = detail.variants[0].id;
    const updated = await svc.updateVariant(
      factory.id,
      ownerActor(owner.id),
      created.id,
      variantId,
      { code: "V1", name: "White", unitPriceDelta: 12.5 },
    );
    expect(Number(updated.unitPriceDelta)).toBeCloseTo(12.5, 2);
  });

  it("searchForPicker matches by code, name, partial", async () => {
    const { factory, owner } = await makeFactory("e");
    const svc = ensureService();
    await svc.create(factory.id, ownerActor(owner.id), {
      code: "MARBLE-001",
      name: "White Marble",
      defaultUnitPrice: 100,
    });
    await svc.create(factory.id, ownerActor(owner.id), {
      code: "GRAN-001",
      name: "Black Granite",
      defaultUnitPrice: 200,
    });

    const byCode = await svc.searchForPicker(factory.id, "OWNER", "MARBLE");
    expect(byCode.find((p) => p.code === "MARBLE-001")).toBeDefined();

    const byName = await svc.searchForPicker(factory.id, "OWNER", "Granite");
    expect(byName.find((p) => p.code === "GRAN-001")).toBeDefined();

    const partial = await svc.searchForPicker(factory.id, "OWNER", "001");
    expect(partial.length).toBeGreaterThanOrEqual(2);
  });

  it("softDelete excludes from default list", async () => {
    const { factory, owner } = await makeFactory("f");
    const svc = ensureService();
    const p = await svc.create(factory.id, ownerActor(owner.id), {
      code: "P-4",
      name: "Tmp",
      defaultUnitPrice: 10,
    });
    await svc.softDelete(factory.id, ownerActor(owner.id), p.id);
    const list = await svc.list(factory.id, "OWNER");
    expect(list.find((x) => x.id === p.id)).toBeUndefined();
  });

  it("cross-factory isolation", async () => {
    const a = await makeFactory("g1");
    const b = await makeFactory("g2");
    const svc = ensureService();
    const pa = await svc.create(a.factory.id, ownerActor(a.owner.id), {
      code: "P-X",
      name: "Product X",
      defaultUnitPrice: 1,
    });
    await expect(
      svc.getById(b.factory.id, "OWNER", pa.id),
    ).rejects.toMatchObject({
      status: 404,
    });
    const bList = await svc.list(b.factory.id, "OWNER");
    expect(bList.find((x) => x.id === pa.id)).toBeUndefined();
  });

  it("SALES_MANAGER view-only", async () => {
    const { factory, owner } = await makeFactory("h");
    const sales = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "sales@h.local",
        firstName: "Sales",
        lastName: "Mgr",
        role: "SALES_MANAGER",
        status: "ACTIVE",
      },
    });
    const svc = ensureService();
    const p = await svc.create(factory.id, ownerActor(owner.id), {
      code: "P-5",
      name: "ViewOnly",
      defaultUnitPrice: 5,
    });

    const fetched = await svc.getById(factory.id, "SALES_MANAGER", p.id);
    expect(fetched.id).toBe(p.id);

    await expect(
      svc.create(
        factory.id,
        { userId: sales.id, role: "SALES_MANAGER" },
        {
          code: "P-6",
          name: "Denied",
          defaultUnitPrice: 1,
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
