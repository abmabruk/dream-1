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

const describeComment = isIntegrationDbAvailable()
  ? describe.sequential
  : describe.sequential.skip;

describeComment("CommentService — DB-backed", () => {
  let cleanup: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createIntegrationDatabase>>["prisma"];
  let CommentService: typeof import("./comment.service").CommentService;

  beforeAll(async () => {
    const db = await createIntegrationDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
    process.env.DATABASE_URL = db.databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();
    ({ CommentService } = await import("./comment.service"));
  }, 30_000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it("creates a comment with @firstname mention and emits a notification", async () => {
    const factory = await prisma.factory.create({
      data: { name: "F1", slug: "f1", currency: "SAR" },
    });
    const author = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "author@f1.local",
        firstName: "Author",
        lastName: "Person",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    const sara = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "sara@f1.local",
        firstName: "Sara",
        lastName: "Smith",
        role: "FACTORY_MANAGER",
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
        ownerUserId: author.id,
      },
    });
    const task = await prisma.projectTask.create({
      data: {
        factoryId: factory.id,
        projectId: project.id,
        title: "Test task",
        status: "BACKLOG",
        priority: "MEDIUM",
        sortOrder: 0,
      },
    });

    const service = new CommentService();
    const created = await service.create(
      factory.id,
      { userId: author.id, role: "OWNER" },
      project.id,
      task.id,
      { body: "ping @sara please review" },
    );

    expect(created.body).toContain("@sara");
    expect(created.mentionedUserIds).toContain(sara.id);

    const notes = await prisma.notification.findMany({
      where: { factoryId: factory.id, userId: sara.id },
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].type).toBe("TASK_MENTIONED");
  });
});
