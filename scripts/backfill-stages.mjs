/**
 * One-shot backfill: for every existing project that has zero stage instances,
 * instantiate stage instances from the factory's active ProjectStage templates,
 * and ensure a default Main Location exists.
 *
 * Run with: node scripts/backfill-stages.mjs
 *
 * Idempotent — projects that already have stage instances or a location are skipped.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before running backfill.");
  }
  return process.env.DATABASE_URL;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
});

async function backfillFactory(factory) {
  const stages = await prisma.projectStage.findMany({
    where: { factoryId: factory.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (stages.length === 0) {
    console.log(`[skip] factory=${factory.slug} has no active stage templates.`);
    return;
  }

  const projects = await prisma.project.findMany({
    where: { factoryId: factory.id },
    select: { id: true, code: true },
  });

  let createdInstances = 0;
  let createdLocations = 0;

  for (const project of projects) {
    const existing = await prisma.projectStageInstance.count({
      where: { projectId: project.id },
    });

    if (existing === 0) {
      for (const stage of stages) {
        await prisma.projectStageInstance.create({
          data: {
            factoryId: factory.id,
            projectId: project.id,
            stageId: stage.id,
            status: "NOT_STARTED",
          },
        });
        createdInstances += 1;
      }
    }

    const locCount = await prisma.location.count({
      where: { projectId: project.id },
    });
    if (locCount === 0) {
      await prisma.location.create({
        data: {
          factoryId: factory.id,
          projectId: project.id,
          name: "الموقع الرئيسي",
          sortOrder: 0,
        },
      });
      createdLocations += 1;
    }
  }

  console.log(
    `[ok] factory=${factory.slug} projects=${projects.length} stage_instances+=${createdInstances} locations+=${createdLocations}`,
  );
}

async function main() {
  const factories = await prisma.factory.findMany();
  for (const factory of factories) {
    await backfillFactory(factory);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
