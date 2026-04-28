import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before running this script.");
  }
  return process.env.DATABASE_URL;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
});

// Identical to prisma/seed.mjs and src/modules/auth/password.ts (scrypt + 16-byte salt, 64-byte key, "salt:key" format).
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

const TEST_PASSWORD = "dream12345";

const TEST_USERS = [
  {
    email: "factory_manager@dream1.local",
    firstName: "Factory",
    lastName: "Manager",
    role: "FACTORY_MANAGER",
    phone: "+966500000010",
  },
  {
    email: "sales@dream1.local",
    firstName: "Sales",
    lastName: "Manager",
    role: "SALES_MANAGER",
    phone: "+966500000011",
  },
  {
    email: "supervisor@dream1.local",
    firstName: "Floor",
    lastName: "Supervisor",
    role: "SUPERVISOR",
    phone: "+966500000012",
  },
  {
    email: "worker1@dream1.local",
    firstName: "Worker",
    lastName: "One",
    role: "WORKER",
    phone: "+966500000013",
  },
  {
    email: "worker2@dream1.local",
    firstName: "Worker",
    lastName: "Two",
    role: "WORKER",
    phone: "+966500000014",
  },
  {
    email: "accountant@dream1.local",
    firstName: "Factory",
    lastName: "Accountant",
    role: "ACCOUNTANT",
    phone: "+966500000015",
  },
];

async function main() {
  console.log("\nDream 1 — create-test-users\n");

  // Find a factory: prefer the seeded one, fall back to first factory by createdAt.
  const factory =
    (await prisma.factory.findUnique({ where: { slug: "dream-main" } })) ??
    (await prisma.factory.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!factory) {
    console.error("No factory found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  console.log(`Factory: ${factory.name} (${factory.slug})\n`);

  const summary = {
    created: [],
    skipped: [],
  };

  for (const user of TEST_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true, role: true, status: true, factoryId: true },
    });

    if (existing) {
      summary.skipped.push({
        email: user.email,
        reason:
          existing.factoryId === factory.id
            ? `already exists (role=${existing.role}, status=${existing.status})`
            : `already exists in another factory (factoryId=${existing.factoryId})`,
      });
      continue;
    }

    await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: "ACTIVE",
        phone: user.phone,
        passwordHash: hashPassword(TEST_PASSWORD),
      },
    });

    summary.created.push({ email: user.email, role: user.role });
  }

  console.log("---------- Summary ----------");
  console.log(`Created : ${summary.created.length}`);
  for (const u of summary.created) {
    console.log(`  + ${u.email}  (${u.role})`);
  }
  console.log(`Skipped : ${summary.skipped.length}`);
  for (const u of summary.skipped) {
    console.log(`  = ${u.email}  — ${u.reason}`);
  }

  console.log(`\nAll test users use password: ${TEST_PASSWORD}`);
  console.log(
    "Sign-in URL: /sign-in   (sample: factory_manager@dream1.local / dream12345)\n",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
