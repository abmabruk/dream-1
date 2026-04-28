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

const describeCost = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

describeCost("CostService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let CostService: typeof import("./cost.service").CostService;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    ({ CostService } = await import("./cost.service"));
  }, 30_000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it("creates a cost, logs activity, and reflects in the project summary", async () => {
    const factory = await prisma.factory.create({
      data: { name: "F1", slug: "f1", currency: "SAR" },
    });
    const owner = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "owner@f1.local",
        firstName: "Owner",
        lastName: "Person",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    const project = await prisma.project.create({
      data: {
        factoryId: factory.id,
        code: "P1",
        name: "Project One",
        status: "PLANNING",
        priority: "MEDIUM",
        ownerUserId: owner.id,
      },
    });

    const service = new CostService();
    await service.create(
      factory.id,
      { userId: owner.id, role: "OWNER" },
      {
        projectId: project.id,
        amount: "250.00",
        category: "MATERIAL",
        description: "Wood",
        currency: "SAR",
        incurredAt: "2026-04-28",
      },
    );

    const summary = await service.summaryByProject(factory.id, "OWNER", project.id);
    expect(summary.totalCost).toBe("250.00");
    expect(summary.costsByCategory.MATERIAL).toBe("250.00");

    // activity should record the COST_ADDED event
    const activities = await prisma.projectActivity.findMany({
      where: { factoryId: factory.id, projectId: project.id },
    });
    const types = activities.map((a) => a.type);
    expect(types).toContain("COST_ADDED");
  });

  it("rejects when role lacks costs:manage", async () => {
    const factory = await prisma.factory.create({
      data: { name: "F2", slug: "f2", currency: "SAR" },
    });
    const supervisor = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "sup@f2.local",
        firstName: "Sup",
        lastName: "Visor",
        role: "SUPERVISOR",
        status: "ACTIVE",
      },
    });
    const project = await prisma.project.create({
      data: {
        factoryId: factory.id,
        code: "P2",
        name: "Project Two",
        status: "PLANNING",
        priority: "MEDIUM",
        ownerUserId: supervisor.id,
      },
    });

    const service = new CostService();
    await expect(
      service.create(
        factory.id,
        { userId: supervisor.id, role: "SUPERVISOR" },
        {
          projectId: project.id,
          amount: "10.00",
          category: "MATERIAL",
          description: "Nope",
          currency: "SAR",
          incurredAt: "2026-04-28",
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
