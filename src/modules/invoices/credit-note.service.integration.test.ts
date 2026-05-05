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

const describeCN = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

type Actor = { userId: string; role: string };

type InvoiceDTO = { id: string; status: string; total: string };

type CreditNoteDTO = {
  id: string;
  status: string;
  number: string | null;
  invoiceId: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  voidedAt?: string | null;
};

type InvoiceServiceCtor = new () => {
  create: (
    factoryId: string,
    actor: Actor,
    input: unknown,
  ) => Promise<InvoiceDTO>;
  send: (
    factoryId: string,
    actor: Actor,
    invoiceId: string,
  ) => Promise<InvoiceDTO>;
};

type CreditNoteServiceCtor = new () => {
  create: (
    factoryId: string,
    actor: Actor,
    invoiceId: string,
    input: unknown,
  ) => Promise<CreditNoteDTO>;
  issue: (
    factoryId: string,
    actor: Actor,
    creditNoteId: string,
  ) => Promise<CreditNoteDTO>;
  void: (
    factoryId: string,
    actor: Actor,
    creditNoteId: string,
  ) => Promise<CreditNoteDTO>;
  getById: (
    factoryId: string,
    role: string,
    creditNoteId: string,
  ) => Promise<CreditNoteDTO | null>;
};

describeCN("CreditNoteService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let InvoiceService: InvoiceServiceCtor | undefined;
  let CreditNoteService: CreditNoteServiceCtor | undefined;
  let cnLoadError: Error | undefined;

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
    } catch {
      InvoiceService = undefined;
    }
    try {
      const mod = (await import("./credit-note.service")) as unknown as {
        CreditNoteService: CreditNoteServiceCtor;
      };
      CreditNoteService = mod.CreditNoteService;
    } catch (err) {
      cnLoadError = err as Error;
    }
  }, 60_000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  function ensureCN() {
    if (!CreditNoteService) {
      throw new Error(
        `CreditNoteService not available — Agent B has not implemented credit-note.service.ts yet. Underlying: ${cnLoadError?.message ?? "unknown"}`,
      );
    }
    return new CreditNoteService();
  }

  function ensureInvoice() {
    if (!InvoiceService) {
      throw new Error(
        "InvoiceService not available — required for these tests",
      );
    }
    return new InvoiceService();
  }

  function ownerActor(userId: string): Actor {
    return { userId, role: "OWNER" };
  }

  async function makeScenario(suffix = "") {
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
    return { factory, owner, customer };
  }

  async function makeSentInvoice(
    factoryId: string,
    actor: Actor,
    customerId: string,
  ) {
    const inv = ensureInvoice();
    const draft = await inv.create(factoryId, actor, {
      customerId,
      taxRate: 15,
      lines: [{ description: "Item", quantity: 2, unitPrice: 100 }],
    });
    return inv.send(factoryId, actor, draft.id);
  }

  it("creates a DRAFT credit note linked to invoice", async () => {
    const { factory, owner, customer } = await makeScenario("a");
    const sent = await makeSentInvoice(
      factory.id,
      ownerActor(owner.id),
      customer.id,
    );
    const svc = ensureCN();
    const cn = await svc.create(factory.id, ownerActor(owner.id), sent.id, {
      reason: "partial return",
      taxRate: 15,
      lines: [{ description: "Returned item", quantity: 1, unitPrice: 100 }],
    });
    expect(cn.status).toBe("DRAFT");
    expect(cn.invoiceId).toBe(sent.id);
  });

  it("issue → ISSUED, gets number CN-2026-00001", async () => {
    const { factory, owner, customer } = await makeScenario("b");
    const sent = await makeSentInvoice(
      factory.id,
      ownerActor(owner.id),
      customer.id,
    );
    const svc = ensureCN();
    const cn = await svc.create(factory.id, ownerActor(owner.id), sent.id, {
      reason: "return",
      taxRate: 15,
      lines: [{ description: "Returned", quantity: 1, unitPrice: 100 }],
    });
    const issued = await svc.issue(factory.id, ownerActor(owner.id), cn.id);
    expect(issued.status).toBe("ISSUED");
    expect(issued.number).toBe("CN-2026-00001");
  });

  it("void ISSUED → VOID", async () => {
    const { factory, owner, customer } = await makeScenario("c");
    const sent = await makeSentInvoice(
      factory.id,
      ownerActor(owner.id),
      customer.id,
    );
    const svc = ensureCN();
    const cn = await svc.create(factory.id, ownerActor(owner.id), sent.id, {
      reason: "return",
      taxRate: 15,
      lines: [{ description: "Returned", quantity: 1, unitPrice: 100 }],
    });
    await svc.issue(factory.id, ownerActor(owner.id), cn.id);
    const voided = await svc.void(factory.id, ownerActor(owner.id), cn.id);
    expect(voided.status).toBe("VOID");
    expect(voided.voidedAt).toBeTruthy();
  });

  it("line totals computed correctly (qty=2 price=50 tax 15% → 100/15/115)", async () => {
    const { factory, owner, customer } = await makeScenario("d");
    const sent = await makeSentInvoice(
      factory.id,
      ownerActor(owner.id),
      customer.id,
    );
    const svc = ensureCN();
    const cn = await svc.create(factory.id, ownerActor(owner.id), sent.id, {
      reason: "return",
      taxRate: 15,
      lines: [{ description: "Returned", quantity: 2, unitPrice: 50 }],
    });
    expect(Number(cn.subtotal)).toBeCloseTo(100, 2);
    expect(Number(cn.taxAmount)).toBeCloseTo(15, 2);
    expect(Number(cn.total)).toBeCloseTo(115, 2);
  });

  it("cross-factory isolation: factoryB cannot read factoryA credit note", async () => {
    const a = await makeScenario("xa");
    const b = await makeScenario("xb");
    const sent = await makeSentInvoice(
      a.factory.id,
      ownerActor(a.owner.id),
      a.customer.id,
    );
    const svc = ensureCN();
    const cn = await svc.create(a.factory.id, ownerActor(a.owner.id), sent.id, {
      reason: "return",
      taxRate: 15,
      lines: [{ description: "Returned", quantity: 1, unitPrice: 50 }],
    });
    await expect(
      svc.getById(b.factory.id, "OWNER", cn.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});
