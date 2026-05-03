import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

declare global {
  var __dreamPrisma: PrismaClient | undefined;
}

export type PrismaTransaction = Prisma.TransactionClient;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured before using Prisma.");
  }

  return databaseUrl;
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!global.__dreamPrisma) {
      global.__dreamPrisma = createPrismaClient();
    }
    return Reflect.get(global.__dreamPrisma, prop, global.__dreamPrisma);
  },
});
