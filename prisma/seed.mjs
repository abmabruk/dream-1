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
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    console.error("Refusing to seed production. Set ALLOW_PROD_SEED=true to override.");
    process.exit(1);
  }

  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "dream12345";

  if (initialPassword === "dream12345" && process.env.NODE_ENV === "production") {
    console.error("Refusing to seed production with the default weak password. Set INITIAL_ADMIN_PASSWORD to a strong value.");
    process.exit(1);
  }

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
        passwordHash: hashPassword(initialPassword),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: "ACTIVE",
        phone: user.phone,
      },
    });
  }

  // --- Default project stages ---
  const defaultStages = [
    {
      slug: "lead_brief",
      name: "استلام واستفسار",
      ownerRole: "SALES_MANAGER",
      sortOrder: 0,
      requiresDepositAttestation: false,
    },
    {
      slug: "design_quote",
      name: "تصميم وعرض سعر",
      ownerRole: "SALES_MANAGER",
      sortOrder: 1,
      requiresDepositAttestation: false,
    },
    {
      slug: "deposit_handoff",
      name: "عربون وتسليم",
      ownerRole: "OWNER",
      sortOrder: 2,
      requiresDepositAttestation: true,
    },
    {
      slug: "engineering_procurement",
      name: "هندسة ومشتريات",
      ownerRole: "FACTORY_MANAGER",
      sortOrder: 3,
      requiresDepositAttestation: false,
    },
    {
      slug: "production_finishing",
      name: "إنتاج وتشطيب",
      ownerRole: "FACTORY_MANAGER",
      sortOrder: 4,
      requiresDepositAttestation: false,
      expectedDays: 14,
    },
    {
      slug: "delivery_install_closeout",
      name: "تسليم وتركيب وإقفال",
      ownerRole: "OWNER",
      sortOrder: 5,
      requiresDepositAttestation: false,
    },
  ];

  for (const stage of defaultStages) {
    await prisma.projectStage.upsert({
      where: {
        factoryId_slug: { factoryId: factory.id, slug: stage.slug },
      },
      update: {
        name: stage.name,
        ownerRole: stage.ownerRole,
        sortOrder: stage.sortOrder,
        requiresDepositAttestation: stage.requiresDepositAttestation,
        expectedDays: stage.expectedDays ?? null,
        isActive: true,
      },
      create: {
        factoryId: factory.id,
        slug: stage.slug,
        name: stage.name,
        ownerRole: stage.ownerRole,
        sortOrder: stage.sortOrder,
        requiresDepositAttestation: stage.requiresDepositAttestation,
        expectedDays: stage.expectedDays ?? null,
        isActive: true,
      },
    });
  }

  console.log("Seeded default owner account:");
  console.log("email: owner@dream1.local");
  if (process.env.NODE_ENV !== "production") {
    console.log(`(dev only) seed password: ${initialPassword}`);
  }
  console.log(`Seeded ${defaultStages.length} default project stages.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
