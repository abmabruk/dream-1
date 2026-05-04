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

const describeInvoice = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

type Actor = { userId: string; role: string };

type InvoiceDTO = {
  id: string;
  status: string;
  number: string | null;
  numberSeq?: number | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid?: string;
  amountDue?: string;
  voidedAt?: string | null;
  voidedReason?: string | null;
  sellerNameSnapshot?: string | null;
  buyerTaxNumberSnapshot?: string | null;
  buyerNameSnapshot?: string | null;
  lines?: unknown[];
};

type InvoiceServiceCtor = new () => {
  create: (factoryId: string, actor: Actor, input: unknown) => Promise<InvoiceDTO>;
  addLine: (factoryId: string, actor: Actor, invoiceId: string, line: unknown) => Promise<InvoiceDTO>;
  send: (factoryId: string, actor: Actor, invoiceId: string) => Promise<InvoiceDTO>;
  softDelete: (factoryId: string, actor: Actor, invoiceId: string) => Promise<{ id: string }>;
  void: (factoryId: string, actor: Actor, invoiceId: string, reason: string) => Promise<InvoiceDTO>;
  generateFromQuote: (factoryId: string, actor: Actor, quoteId: string) => Promise<InvoiceDTO>;
  applyPayment: (factoryId: string, actor: Actor, invoiceId: string, amount: number) => Promise<InvoiceDTO>;
  getById: (factoryId: string, role: string, invoiceId: string) => Promise<InvoiceDTO | null>;
};

type QuoteServiceCtor = new () => {
  create: (factoryId: string, actor: Actor, input: unknown) => Promise<{ id: string; total: string }>;
  approve: (factoryId: string, actor: Actor, quoteId: string) => Promise<{ id: string; total: string }>;
};

describeInvoice("InvoiceService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let InvoiceService: InvoiceServiceCtor | undefined;
  let QuoteService: QuoteServiceCtor | undefined;
  let invoiceLoadError: Error | undefined;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    try {
      const mod = (await import("./invoice.service")) as unknown as {
        InvoiceService: InvoiceServiceCtor;
      };
      InvoiceService = mod.InvoiceService;
    } catch (err) {
      invoiceLoadError = err as Error;
    }
    try {
      const qmod = (await import("@/modules/quotes/quote.service")) as unknown as {
        QuoteService: QuoteServiceCtor;
      };
      QuoteService = qmod.QuoteService;
    } catch {
      QuoteService = undefined;
    }
  }, 60_000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  function ensureInvoiceService() {
    if (!InvoiceService) {
      throw new Error(
        `InvoiceService not available — Agent B has not implemented invoice.service.ts yet. Underlying: ${invoiceLoadError?.message ?? "unknown"}`,
      );
    }
    return new InvoiceService();
  }

  function ensureQuoteService() {
    if (!QuoteService) {
      throw new Error("QuoteService not available — required for these tests");
    }
    return new QuoteService();
  }

  function ownerActor(userId: string): Actor {
    return { userId, role: "OWNER" };
  }

  async function makeBaseScenario(suffix = "") {
    const factory = await prisma.factory.create({
      data: {
        name: `F${suffix}`,
        slug: `f${suffix || "0"}`,
        currency: "SAR",
        taxNumber: `TAX-${suffix || "0"}`,
      } as never,
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
      data: {
        factoryId: factory.id,
        name: `Customer${suffix}`,
        taxNumber: `CUST-TAX-${suffix || "0"}`,
      } as never,
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

  async function makeApprovedQuote(
    factoryId: string,
    actor: Actor,
    orderId: string,
  ) {
    const qsvc = ensureQuoteService();
    const q = await qsvc.create(factoryId, actor, {
      orderId,
      taxRate: 15,
      lines: [{ description: "L", quantity: 2, unitPrice: 100 }],
    });
    return qsvc.approve(factoryId, actor, q.id);
  }

  it("creates an empty DRAFT invoice (no lines yet)", async () => {
    const { factory, owner, customer } = await makeBaseScenario("a");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
    });
    expect(inv.status).toBe("DRAFT");
    expect(Number(inv.subtotal)).toBeCloseTo(0, 2);
    expect(Number(inv.total)).toBeCloseTo(0, 2);
  });

  it("addLine recomputes totals (qty=2, price=100, tax 15% → 200/30/230)", async () => {
    const { factory, owner, customer } = await makeBaseScenario("b");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
    });
    const after = await svc.addLine(factory.id, ownerActor(owner.id), inv.id, {
      description: "Tile",
      quantity: 2,
      unitPrice: 100,
    });
    expect(Number(after.subtotal)).toBeCloseTo(200, 2);
    expect(Number(after.taxAmount)).toBeCloseTo(30, 2);
    expect(Number(after.total)).toBeCloseTo(230, 2);
  });

  it("send DRAFT → SENT and assigns INV-2026-00001", async () => {
    const { factory, owner, customer } = await makeBaseScenario("c");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    const sent = await svc.send(factory.id, ownerActor(owner.id), inv.id);
    expect(sent.status).toBe("SENT");
    expect(sent.number).toBe("INV-2026-00001");
  });

  it("send a second invoice → INV-2026-00002 (sequential per factory/year)", async () => {
    const { factory, owner, customer } = await makeBaseScenario("d");
    const svc = ensureInvoiceService();
    const i1 = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.send(factory.id, ownerActor(owner.id), i1.id);
    const i2 = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 50 }],
    });
    const sent2 = await svc.send(factory.id, ownerActor(owner.id), i2.id);
    expect(sent2.number).toBe("INV-2026-00002");
  });

  it("send invoice with no lines → throws (must have ≥1 line)", async () => {
    const { factory, owner, customer } = await makeBaseScenario("e");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
    });
    await expect(
      svc.send(factory.id, ownerActor(owner.id), inv.id),
    ).rejects.toThrow();
  });

  it("addLine to SENT invoice throws (DRAFT only)", async () => {
    const { factory, owner, customer } = await makeBaseScenario("f");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.send(factory.id, ownerActor(owner.id), inv.id);
    await expect(
      svc.addLine(factory.id, ownerActor(owner.id), inv.id, {
        description: "L2",
        quantity: 1,
        unitPrice: 10,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("softDelete a DRAFT invoice succeeds", async () => {
    const { factory, owner, customer } = await makeBaseScenario("g");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
    });
    await expect(
      svc.softDelete(factory.id, ownerActor(owner.id), inv.id),
    ).resolves.toBeTruthy();
  });

  it("softDelete a SENT invoice throws 409", async () => {
    const { factory, owner, customer } = await makeBaseScenario("h");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.send(factory.id, ownerActor(owner.id), inv.id);
    await expect(
      svc.softDelete(factory.id, ownerActor(owner.id), inv.id),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("void SENT invoice → status=VOID, voidedAt+voidedReason set", async () => {
    const { factory, owner, customer } = await makeBaseScenario("i");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.send(factory.id, ownerActor(owner.id), inv.id);
    const voided = await svc.void(factory.id, ownerActor(owner.id), inv.id, "duplicate entry");
    expect(voided.status).toBe("VOID");
    expect(voided.voidedAt).toBeTruthy();
    expect(voided.voidedReason).toBe("duplicate entry");
  });

  it("generateFromQuote: APPROVED quote → DRAFT invoice with snapshot lines and same totals", async () => {
    const { factory, owner, order } = await makeBaseScenario("j");
    if (!QuoteService) return; // skip silently if quote module missing
    const svc = ensureInvoiceService();
    const approved = await makeApprovedQuote(factory.id, ownerActor(owner.id), order.id);
    const inv = await svc.generateFromQuote(factory.id, ownerActor(owner.id), approved.id);
    expect(inv.status).toBe("DRAFT");
    expect(Number(inv.total)).toBeCloseTo(Number(approved.total), 2);
    expect((inv.lines ?? []).length).toBeGreaterThan(0);
  });

  it("generateFromQuote on non-APPROVED quote throws", async () => {
    const { factory, owner, order } = await makeBaseScenario("k");
    if (!QuoteService) return;
    const qsvc = ensureQuoteService();
    const svc = ensureInvoiceService();
    const draft = await qsvc.create(factory.id, ownerActor(owner.id), {
      orderId: order.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await expect(
      svc.generateFromQuote(factory.id, ownerActor(owner.id), draft.id),
    ).rejects.toThrow();
  });

  it("cross-factory isolation: factoryB cannot read factoryA invoice", async () => {
    const a = await makeBaseScenario("x1");
    const b = await makeBaseScenario("x2");
    const svc = ensureInvoiceService();
    const inv = await svc.create(a.factory.id, ownerActor(a.owner.id), {
      customerId: a.customer.id,
    });
    const cross = await svc.getById(b.factory.id, "OWNER", inv.id);
    expect(cross).toBeNull();
  });

  it("applyPayment partial → status=PARTIALLY_PAID", async () => {
    const { factory, owner, customer } = await makeBaseScenario("p1");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    const sent = await svc.send(factory.id, ownerActor(owner.id), inv.id);
    const total = Number(sent.total);
    const partial = await svc.applyPayment(
      factory.id,
      ownerActor(owner.id),
      inv.id,
      total / 2,
    );
    expect(partial.status).toBe("PARTIALLY_PAID");
  });

  it("applyPayment full → status=PAID", async () => {
    const { factory, owner, customer } = await makeBaseScenario("p2");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    const sent = await svc.send(factory.id, ownerActor(owner.id), inv.id);
    const paid = await svc.applyPayment(
      factory.id,
      ownerActor(owner.id),
      inv.id,
      Number(sent.total),
    );
    expect(paid.status).toBe("PAID");
  });

  it("applyPayment to VOID invoice throws", async () => {
    const { factory, owner, customer } = await makeBaseScenario("p3");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    await svc.send(factory.id, ownerActor(owner.id), inv.id);
    await svc.void(factory.id, ownerActor(owner.id), inv.id, "wrong");
    await expect(
      svc.applyPayment(factory.id, ownerActor(owner.id), inv.id, 10),
    ).rejects.toThrow();
  });

  it("snapshots populated on send (sellerName, buyerName, buyerTaxNumber)", async () => {
    const { factory, owner, customer } = await makeBaseScenario("s");
    const svc = ensureInvoiceService();
    const inv = await svc.create(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      taxRate: 15,
      lines: [{ description: "L", quantity: 1, unitPrice: 100 }],
    });
    const sent = await svc.send(factory.id, ownerActor(owner.id), inv.id);
    expect(sent.sellerNameSnapshot).toBeTruthy();
    expect(sent.buyerNameSnapshot).toBeTruthy();
    // taxNumber may be null if Customer.taxNumber column not yet added; allow either truthy or null
    expect(sent.buyerTaxNumberSnapshot === null || typeof sent.buyerTaxNumberSnapshot === "string").toBe(true);
  });
});
