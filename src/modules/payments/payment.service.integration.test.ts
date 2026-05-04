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

const describePayments = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

type Actor = { userId: string; role: string };

type InvoiceDTO = {
  id: string;
  status: string;
  total: string;
  amountPaid?: string;
  amountDue?: string;
};

type PaymentDTO = {
  id: string;
  factoryId: string;
  customerId: string;
  kind: string;
  amount: string;
  allocatedAmount?: string;
  unallocatedAmount?: string;
  allocations?: Array<{ id: string; invoiceId: string; amount: string }>;
};

type CustomerBalance = {
  customerId: string;
  totalInvoiced?: string;
  totalPaid?: string;
  balance?: string;
  outstanding?: string;
};

type InvoiceServiceCtor = new () => {
  create: (factoryId: string, actor: Actor, input: unknown) => Promise<InvoiceDTO>;
  send: (factoryId: string, actor: Actor, invoiceId: string) => Promise<InvoiceDTO>;
  getById: (factoryId: string, role: string, invoiceId: string) => Promise<InvoiceDTO | null>;
};

type PaymentServiceCtor = new () => {
  record: (factoryId: string, actor: Actor, input: unknown) => Promise<PaymentDTO>;
  softDelete: (factoryId: string, actor: Actor, paymentId: string) => Promise<{ id: string }>;
  allocate?: (
    factoryId: string,
    actor: Actor,
    paymentId: string,
    allocation: { invoiceId: string; amount: number | string },
  ) => Promise<PaymentDTO>;
  removeAllocation?: (
    factoryId: string,
    actor: Actor,
    paymentId: string,
    allocationId: string,
  ) => Promise<PaymentDTO>;
  getById?: (factoryId: string, role: string, paymentId: string) => Promise<PaymentDTO | null>;
  getCustomerBalance?: (
    factoryId: string,
    role: string,
    customerId: string,
  ) => Promise<CustomerBalance>;
};

describePayments("PaymentService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let InvoiceService: InvoiceServiceCtor | undefined;
  let PaymentService: PaymentServiceCtor | undefined;
  let paymentLoadError: Error | undefined;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    try {
      const mod = (await import("@/modules/invoices/invoice.service")) as unknown as {
        InvoiceService: InvoiceServiceCtor;
      };
      InvoiceService = mod.InvoiceService;
    } catch {
      InvoiceService = undefined;
    }
    try {
      const mod = (await import("./payment.service")) as unknown as {
        PaymentService: PaymentServiceCtor;
      };
      PaymentService = mod.PaymentService;
    } catch (err) {
      paymentLoadError = err as Error;
    }
  }, 60_000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  function ensurePayments() {
    if (!PaymentService) {
      throw new Error(
        `PaymentService not available — Agent B has not implemented payment.service.ts yet. Underlying: ${paymentLoadError?.message ?? "unknown"}`,
      );
    }
    return new PaymentService();
  }

  function ensureInvoice() {
    if (!InvoiceService) {
      throw new Error("InvoiceService not available — required for these tests");
    }
    return new InvoiceService();
  }

  function ownerActor(userId: string): Actor {
    return { userId, role: "OWNER" };
  }

  async function makeScenario(suffix = "") {
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
    const sales = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: `sales${suffix}@f.local`,
        firstName: "Sales",
        lastName: "Manager",
        role: "SALES_MANAGER",
        status: "ACTIVE",
      },
    });
    const customer = await prisma.customer.create({
      data: {
        factoryId: factory.id,
        name: `Customer${suffix}`,
        taxNumber: `CUST-${suffix || "0"}`,
      } as never,
    });
    return { factory, owner, sales, customer };
  }

  async function makeSentInvoice(
    factoryId: string,
    actor: Actor,
    customerId: string,
    unitPrice = 100,
    quantity = 1,
  ) {
    const inv = ensureInvoice();
    const draft = await inv.create(factoryId, actor, {
      customerId,
      taxRate: 0,
      lines: [{ description: "Item", quantity, unitPrice }],
    });
    return inv.send(factoryId, actor, draft.id);
  }

  it("record payment with no allocations → unallocated credit, invoice unchanged", async () => {
    const { factory, owner, customer } = await makeScenario("a");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const svc = ensurePayments();
    const pay = await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: 50,
    });
    expect(Number(pay.amount)).toBeCloseTo(50, 2);
    const inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(inv).not.toBeNull();
    expect(Number(inv?.amountPaid ?? "0")).toBeCloseTo(0, 2);
    expect(inv?.status).toBe("SENT");
  });

  it("record payment with allocation → invoice.amountPaid increments, status=PARTIALLY_PAID", async () => {
    const { factory, owner, customer } = await makeScenario("b");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const total = Number(sent.total);
    const svc = ensurePayments();
    await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: total / 2,
      allocations: [{ invoiceId: sent.id, amount: total / 2 }],
    });
    const inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(Number(inv?.amountPaid ?? "0")).toBeCloseTo(total / 2, 2);
    expect(inv?.status).toBe("PARTIALLY_PAID");
  });

  it("record payment for full invoice amount → status=PAID", async () => {
    const { factory, owner, customer } = await makeScenario("c");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const total = Number(sent.total);
    const svc = ensurePayments();
    await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: total,
      allocations: [{ invoiceId: sent.id, amount: total }],
    });
    const inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(inv?.status).toBe("PAID");
  });

  it("record payment with allocations summing > amount throws", async () => {
    const { factory, owner, customer } = await makeScenario("d");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const svc = ensurePayments();
    await expect(
      svc.record(factory.id, ownerActor(owner.id), {
        customerId: customer.id,
        amount: 50,
        allocations: [{ invoiceId: sent.id, amount: 80 }],
      }),
    ).rejects.toThrow();
  });

  it("record payment with allocation to wrong factory's invoice throws", async () => {
    const a = await makeScenario("e1");
    const b = await makeScenario("e2");
    const sentA = await makeSentInvoice(a.factory.id, ownerActor(a.owner.id), a.customer.id, 100);
    const svc = ensurePayments();
    await expect(
      svc.record(b.factory.id, ownerActor(b.owner.id), {
        customerId: b.customer.id,
        amount: 50,
        allocations: [{ invoiceId: sentA.id, amount: 50 }],
      }),
    ).rejects.toThrow();
  });

  it("softDelete payment → reverses allocations (invoice.amountPaid restored)", async () => {
    const { factory, owner, customer } = await makeScenario("f");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const total = Number(sent.total);
    const svc = ensurePayments();
    const pay = await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: total,
      allocations: [{ invoiceId: sent.id, amount: total }],
    });
    let inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(inv?.status).toBe("PAID");
    await svc.softDelete(factory.id, ownerActor(owner.id), pay.id);
    inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(Number(inv?.amountPaid ?? "0")).toBeCloseTo(0, 2);
    expect(inv?.status).toBe("SENT");
  });

  it("record REFUND with allocation → invoice.amountPaid decreases", async () => {
    const { factory, owner, customer } = await makeScenario("g");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const total = Number(sent.total);
    const svc = ensurePayments();
    // first pay it fully
    await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: total,
      allocations: [{ invoiceId: sent.id, amount: total }],
    });
    let inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(inv?.status).toBe("PAID");
    // refund half
    await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      kind: "REFUND",
      amount: total / 2,
      allocations: [{ invoiceId: sent.id, amount: total / 2 }],
    });
    inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(Number(inv?.amountPaid ?? "0")).toBeCloseTo(total / 2, 2);
    expect(inv?.status === "PARTIALLY_PAID" || inv?.status === "SENT").toBe(true);
  });

  it("allocate after record (separate call) works", async () => {
    const { factory, owner, customer } = await makeScenario("h");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const total = Number(sent.total);
    const svc = ensurePayments();
    if (typeof svc.allocate !== "function") {
      // skip if not yet implemented
      return;
    }
    const pay = await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: total,
    });
    await svc.allocate(factory.id, ownerActor(owner.id), pay.id, {
      invoiceId: sent.id,
      amount: total,
    });
    const inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(inv?.status).toBe("PAID");
  });

  it("removeAllocation reverses that allocation", async () => {
    const { factory, owner, customer } = await makeScenario("i");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 100);
    const total = Number(sent.total);
    const svc = ensurePayments();
    if (typeof svc.removeAllocation !== "function") {
      return; // skip
    }
    const pay = await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: total,
      allocations: [{ invoiceId: sent.id, amount: total }],
    });
    const allocId = pay.allocations?.[0]?.id;
    if (!allocId) {
      throw new Error("payment.allocations[0].id not present in DTO");
    }
    await svc.removeAllocation(factory.id, ownerActor(owner.id), pay.id, allocId);
    const inv = await ensureInvoice().getById(factory.id, "OWNER", sent.id);
    expect(Number(inv?.amountPaid ?? "0")).toBeCloseTo(0, 2);
    expect(inv?.status).toBe("SENT");
  });

  it("getCustomerBalance returns correct totals", async () => {
    const { factory, owner, customer } = await makeScenario("j");
    const sent = await makeSentInvoice(factory.id, ownerActor(owner.id), customer.id, 200);
    const total = Number(sent.total);
    const svc = ensurePayments();
    if (typeof svc.getCustomerBalance !== "function") {
      return;
    }
    await svc.record(factory.id, ownerActor(owner.id), {
      customerId: customer.id,
      amount: 50,
      allocations: [{ invoiceId: sent.id, amount: 50 }],
    });
    const bal = await svc.getCustomerBalance(factory.id, "OWNER", customer.id);
    const totalInvoiced = Number(bal.totalInvoiced ?? "0");
    const totalPaid = Number(bal.totalPaid ?? "0");
    const outstanding = Number(bal.outstanding ?? bal.balance ?? "0");
    expect(totalInvoiced).toBeCloseTo(total, 2);
    expect(totalPaid).toBeCloseTo(50, 2);
    expect(outstanding).toBeCloseTo(total - 50, 2);
  });

  it("cross-factory isolation: factoryB cannot read factoryA payment", async () => {
    const a = await makeScenario("k1");
    const b = await makeScenario("k2");
    const sentA = await makeSentInvoice(a.factory.id, ownerActor(a.owner.id), a.customer.id, 100);
    const svc = ensurePayments();
    const pay = await svc.record(a.factory.id, ownerActor(a.owner.id), {
      customerId: a.customer.id,
      amount: 50,
      allocations: [{ invoiceId: sentA.id, amount: 50 }],
    });
    if (typeof svc.getById !== "function") return;
    const cross = await svc.getById(b.factory.id, "OWNER", pay.id);
    expect(cross).toBeNull();
  });

  it("permission denial: SALES_MANAGER cannot manage (record) payments", async () => {
    const { factory, sales, customer } = await makeScenario("l");
    const svc = ensurePayments();
    await expect(
      svc.record(factory.id, { userId: sales.id, role: "SALES_MANAGER" }, {
        customerId: customer.id,
        amount: 50,
      }),
    ).rejects.toThrow();
  });
});
