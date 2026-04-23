import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before running the seed.");
  }

  return process.env.DATABASE_URL;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getDatabaseUrl(),
  }),
});

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function main() {
  const factory = await prisma.factory.upsert({
    where: { slug: "dream-main" },
    update: {
      name: "Dream 1 Factory",
      timezone: "Asia/Riyadh",
      currency: "SAR",
      orderCodePrefix: "DRM",
      portalDisplayName: "Dream 1 Factory",
      supportEmail: "owner@dream1.local",
      supportPhone: "+966500000000",
    },
    create: {
      name: "Dream 1 Factory",
      slug: "dream-main",
      timezone: "Asia/Riyadh",
      currency: "SAR",
      orderCodePrefix: "DRM",
      portalDisplayName: "Dream 1 Factory",
      supportEmail: "owner@dream1.local",
      supportPhone: "+966500000000",
    },
  });

  const users = [
    {
      email: "owner@dream1.local",
      firstName: "Dream",
      lastName: "Owner",
      role: "OWNER",
      phone: "+966500000000",
    },
    {
      email: "supervisor@dream1.local",
      firstName: "Factory",
      lastName: "Supervisor",
      role: "SUPERVISOR",
      phone: "+966500000001",
    },
    {
      email: "worker1@dream1.local",
      firstName: "Line",
      lastName: "Worker",
      role: "WORKER",
      phone: "+966500000002",
    },
    {
      email: "worker2@dream1.local",
      firstName: "Assembly",
      lastName: "Worker",
      role: "WORKER",
      phone: "+966500000003",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        status: "ACTIVE",
        role: user.role,
        factoryId: factory.id,
        phone: user.phone,
      },
      create: {
        factoryId: factory.id,
        email: user.email,
        passwordHash: hashPassword("dream12345"),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: "ACTIVE",
        phone: user.phone,
      },
    });
  }

  console.log("Seeded default owner account:");
  console.log("email: owner@dream1.local");
  console.log("password: dream12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
