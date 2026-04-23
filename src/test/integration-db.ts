import "dotenv/config";

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

function getBaseDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before running integration tests.");
  }

  return process.env.DATABASE_URL;
}

function withSchema(databaseUrl: string, schema: string) {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

function withoutPrismaSchemaParam(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.searchParams.delete("schema");
  return url.toString();
}

function runCommand(command: string, args: string[], databaseUrl: string) {
  execFileSync(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "pipe",
  });
}

function runPsql(databaseUrl: string, sql: string) {
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: projectRoot,
    env: process.env,
    stdio: "pipe",
  });
}

export async function disconnectGlobalPrisma() {
  const globalWithPrisma = globalThis as typeof globalThis & {
    __dreamPrisma?: {
      $disconnect: () => Promise<void>;
    };
  };

  if (globalWithPrisma.__dreamPrisma) {
    await globalWithPrisma.__dreamPrisma.$disconnect();
    globalWithPrisma.__dreamPrisma = undefined;
  }
}

export async function createIntegrationDatabase() {
  const baseDatabaseUrl = getBaseDatabaseUrl();
  const schema = `itest_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const databaseUrl = withSchema(baseDatabaseUrl, schema);
  const adminUrl = withoutPrismaSchemaParam(baseDatabaseUrl);

  runPsql(adminUrl, `CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  runCommand("npx", ["prisma", "migrate", "deploy"], databaseUrl);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
    }),
  });

  await prisma.$connect();

  return {
    schema,
    databaseUrl,
    prisma,
    async cleanup() {
      await disconnectGlobalPrisma();
      await prisma.$disconnect();
      runPsql(adminUrl, `DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    },
  };
}

export async function resetIntegrationDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ProjectActivity",
      "WorkQueueItem",
      "ProjectTask",
      "Project",
      "Notification",
      "AttendanceRecord",
      "Assignment",
      "OrderEvent",
      "OrderPortalAccess",
      "Order",
      "Customer",
      "Inquiry",
      "Session",
      "User",
      "Factory"
    RESTART IDENTITY CASCADE
  `);
}
