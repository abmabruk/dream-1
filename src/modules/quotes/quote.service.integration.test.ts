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

const describeQuote = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

type ServiceCtor = new () => {
  create: (
    factoryId: string,
    actor: { userId: string; role: string },
    input: unknown,
  ) => Promise<{
    id: string;
    subtotal: string;
    taxAmount: string;
    total: string;
    status: string;
    version: number;
    parentQuoteId: string | null;
  }>;
  approve: (
    factoryId: string,
    actor: { userId: string; role: string },
    quoteId: string,
  ) => Promise<{ id: string; status: string; total: string }>;
  addLine: (
    factoryId: string,
    actor: { userId: string; role: string },
    quoteId: string,
    line: unknown,
  ) => Promise<{ id: string; subtotal: string; total: string }>;
  duplicate: (
    factoryId: string,
    actor: { userId: string; role: string },
    quoteId: string,
  ) => Promise<{
    id: string;
    version: number;
    status: string;
    parentQuoteId: string | null;
    lines: unknown[];
  }>;
  softDelete: (
    factoryId: string,
    actor: { userId: string; role: string },
    quoteId: string,
  ) => Promise<{ id: string }>;
  getById: (
    factoryId: string,
    role: string,
    quoteId: string,
  ) => Promise<{
    id: string;
    status: string;
    total: string;
    lines: unknown[];
  } | null>;
};

describeQuote("QuoteService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let QuoteService: ServiceCtor | undefined;
  let serviceLoadError: Error | undefined;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    try {
      const mod = (await import("./quote.service")) as unknown as {
        QuoteService: ServiceCtor;
      };
      QuoteService = mod.QuoteService;
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

  async function makeBaseScenario(suffix = "") {
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
    const customer = await prisma.customer.create({
      data: { factoryId: factory.id, name: `Customer${suffix}` },
    });
    const order = await prisma.order.create({
      data: {
        factoryId: factory.id,
        customerId: customer.id,
        code: `O${suffix || "1"}`,
        title: "Test Order",
        status: "DRAFT",
      },
    });
    return { factory, owner, customer, order };
  }

  function ensureService() {
    if (!QuoteService) {
      throw new Error(
        `QuoteService not available — Agent B has not implemented quote.service.ts yet. Underlying error: ${serviceLoadError?.message ?? "unknown"}`,
      );
    }
    return new QuoteService();
  }

  function ownerActor(userId: string) {
    return { userId, role: "OWNER" as const };
  }

  it("creates DRAFT quote with computed totals", async () => {
    const { factory, owner, order } = await makeBaseScenario("a");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      taxInclusive: false,
      lines: [
        { description: "L1", quantity: 2, unitPrice: 100 },
        { description: "L2", quantity: 3, unitPrice: 50 },
      ],
    });
    expect(q.status).toBe("DRAFT");
    expect(Number(q.subtotal)).toBeCloseTo(350, 2);
    expect(Number(q.taxAmount)).toBeCloseTo(52.5, 2);
    expect(Number(q.total)).toBeCloseTo(402.5, 2);
  });

  it("approves quote and updates Order.quotedAmount", async () => {
    const { factory, owner, order } = await makeBaseScenario("b");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 200 }],
    });
    const approved = await svc.approve(factory.id, ownerActor(owner.id), q.id);
    expect(approved.status).toBe("APPROVED");

    const reloaded = await prisma.order.findUnique({ where: { id: order.id } });
    expect(Number(reloaded?.quotedAmount)).toBeCloseTo(
      Number(approved.total),
      2,
    );
  });

  it("auto-supersedes previously approved quote of same order", async () => {
    const { factory, owner, order } = await makeBaseScenario("c");
    const svc = ensureService();
    const v1 = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.approve(factory.id, ownerActor(owner.id), v1.id);

    const v2 = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 2, unitPrice: 100 }],
    });
    const v2Approved = await svc.approve(
      factory.id,
      ownerActor(owner.id),
      v2.id,
    );

    const v1After = await prisma.quote.findUnique({ where: { id: v1.id } });
    const v2After = await prisma.quote.findUnique({ where: { id: v2.id } });
    expect(v1After?.status).toBe("SUPERSEDED");
    expect(v2After?.status).toBe("APPROVED");

    const orderAfter = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(Number(orderAfter?.quotedAmount)).toBeCloseTo(
      Number(v2Approved.total),
      2,
    );
  });

  it("rejects deletion of APPROVED quote", async () => {
    const { factory, owner, order } = await makeBaseScenario("d");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.approve(factory.id, ownerActor(owner.id), q.id);

    await expect(
      svc.softDelete(factory.id, ownerActor(owner.id), q.id),
    ).rejects.toThrow(/لا يمكن حذف|حالة|status|approved/i);
  });

  it("rejects line edit on non-DRAFT quote", async () => {
    const { factory, owner, order } = await makeBaseScenario("e");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.approve(factory.id, ownerActor(owner.id), q.id);

    await expect(
      svc.addLine(factory.id, ownerActor(owner.id), q.id, {
        description: "another",
        quantity: 1,
        unitPrice: 50,
      }),
    ).rejects.toThrow(/حالة|status|draft/i);
  });

  it("computes tax inclusive correctly", async () => {
    const { factory, owner, order } = await makeBaseScenario("f");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      taxInclusive: true,
      lines: [{ description: "L", quantity: 1, unitPrice: 115 }],
    });
    expect(Number(q.subtotal)).toBeCloseTo(100, 2);
    expect(Number(q.taxAmount)).toBeCloseTo(15, 2);
    expect(Number(q.total)).toBeCloseTo(115, 2);
  });

  it("duplicates a quote into next version", async () => {
    const { factory, owner, order } = await makeBaseScenario("g");
    const svc = ensureService();
    const v1 = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [
        { description: "L1", quantity: 1, unitPrice: 100 },
        { description: "L2", quantity: 2, unitPrice: 50 },
      ],
    });
    await svc.approve(factory.id, ownerActor(owner.id), v1.id);

    const v2 = await svc.duplicate(factory.id, ownerActor(owner.id), v1.id);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("DRAFT");
    expect(v2.parentQuoteId).toBe(v1.id);
    expect(v2.lines).toHaveLength(2);

    const v1After = await prisma.quote.findUnique({ where: { id: v1.id } });
    expect(v1After?.status).toBe("APPROVED");
  });

  it("enforces unique [orderId, version]", async () => {
    const { factory, owner, order } = await makeBaseScenario("h");
    const svc = ensureService();
    const v1 = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    expect(v1.version).toBe(1);

    await expect(
      prisma.quote.create({
        data: {
          factoryId: factory.id,
          orderId: order.id,
          version: 1,
          status: "DRAFT",
          currency: "SAR",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects cross-factory access", async () => {
    const a = await makeBaseScenario("i1");
    const b = await makeBaseScenario("i2");
    const svc = ensureService();
    const qa = await svc.create(a.factory.id, ownerActor(a.owner.id), {
      orderId: a.order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });

    // factoryB owner attempts to view factoryA's quote
    await expect(
      svc.getById(b.factory.id, "OWNER", qa.id),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      svc.approve(b.factory.id, ownerActor(b.owner.id), qa.id),
    ).rejects.toThrow();
  });

  it("recomputes totals when line is added", async () => {
    const { factory, owner, order } = await makeBaseScenario("j");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L1", quantity: 1, unitPrice: 100 }],
    });
    expect(Number(q.subtotal)).toBeCloseTo(100, 2);

    const after = await svc.addLine(factory.id, ownerActor(owner.id), q.id, {
      description: "L2",
      quantity: 1,
      unitPrice: 50,
    });
    expect(Number(after.subtotal)).toBeCloseTo(150, 2);
    expect(Number(after.total)).toBeCloseTo(172.5, 2);
  });

  it("supports discount", async () => {
    const { factory, owner, order } = await makeBaseScenario("k");
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      discountAmount: 50,
      lines: [{ description: "L", quantity: 2, unitPrice: 100 }],
    });
    // subtotal=200, after discount=150, tax=22.50, total=172.50
    expect(Number(q.subtotal)).toBeCloseTo(200, 2);
    expect(Number(q.taxAmount)).toBeCloseTo(22.5, 2);
    expect(Number(q.total)).toBeCloseTo(172.5, 2);
  });

  it("blocks SALES_MANAGER from approving", async () => {
    const { factory, owner, order } = await makeBaseScenario("l");
    const sales = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "sales@l.local",
        firstName: "Sales",
        lastName: "Mgr",
        role: "SALES_MANAGER",
        status: "ACTIVE",
      },
    });
    const svc = ensureService();
    const q = await svc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await expect(
      svc.approve(
        factory.id,
        { userId: sales.id, role: "SALES_MANAGER" },
        q.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("subtotal + taxAmount === total within rounding (property test)", async () => {
    const { factory, owner, order } = await makeBaseScenario("p");
    const svc = ensureService();
    for (let i = 0; i < 10; i += 1) {
      // fresh order per iteration to avoid version collisions across factories
      const o = await prisma.order.create({
        data: {
          factoryId: factory.id,
          customerId: order.customerId,
          code: `OP${i}`,
          title: `Iter ${i}`,
          status: "DRAFT",
        },
      });
      const lineCount = 1 + Math.floor(Math.random() * 3);
      const lines = Array.from({ length: lineCount }, (_, idx) => ({
        description: `L${idx}`,
        quantity: Math.max(1, Math.round(Math.random() * 10)),
        unitPrice: Math.round(Math.random() * 1000 * 100) / 100,
      }));
      const q = await svc.create(factory.id, ownerActor(owner.id), {
        orderId: o.id,
        taxRate: 15,
        taxInclusive: false,
        lines,
      });
      const subtotalAfterDiscount = Number(q.subtotal);
      const expected = subtotalAfterDiscount + Number(q.taxAmount);
      expect(Number(q.total).toFixed(2)).toBe(expected.toFixed(2));
    }
  });
});
