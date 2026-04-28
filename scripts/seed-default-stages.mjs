/**
 * One-shot: ensure every factory has the 6 default stage templates.
 * Idempotent — won't duplicate if a stage with the same slug already exists.
 *
 * Run with: node scripts/seed-default-stages.mjs
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_STAGES = [
  { sortOrder: 0, slug: "lead_brief", name: "استلام واستفسار",
    description: "استلام طلب العميل، تأهيل، زيارة موقع، أخذ متطلبات",
    ownerRole: "SALES_MANAGER", isOptional: false, expectedDays: 3,
    requiresDepositAttestation: false },
  { sortOrder: 1, slug: "design_quote", name: "تصميم وعرض سعر",
    description: "تصميم مبدئي، رندر، قائمة مواد مبدئية، عرض سعر مختوم",
    ownerRole: "SALES_MANAGER", isOptional: false, expectedDays: 5,
    requiresDepositAttestation: false },
  { sortOrder: 2, slug: "deposit_handoff", name: "عربون وتسليم",
    description: "استلام العربون، اعتماد رسومات الشغل، تسليم للإنتاج",
    ownerRole: "OWNER", isOptional: false, expectedDays: 2,
    requiresDepositAttestation: true },
  { sortOrder: 3, slug: "engineering_procurement", name: "هندسة ومشتريات",
    description: "رسومات شغل نهائية، طلب المواد طويلة الانتظار",
    ownerRole: "FACTORY_MANAGER", isOptional: false, expectedDays: 7,
    requiresDepositAttestation: false },
  { sortOrder: 4, slug: "production_finishing", name: "إنتاج وتشطيب",
    description: "التصنيع، التجميع، التشطيب، فحص الجودة",
    ownerRole: "FACTORY_MANAGER", isOptional: false, expectedDays: 14,
    requiresDepositAttestation: false },
  { sortOrder: 5, slug: "delivery_install_closeout", name: "تسليم وتركيب وإقفال",
    description: "النقل، التركيب، توقيع الاستلام، قائمة العيوب",
    ownerRole: "OWNER", isOptional: false, expectedDays: 3,
    requiresDepositAttestation: false },
];

async function main() {
  const factories = await prisma.factory.findMany();
  console.log(`Found ${factories.length} factory(ies).\n`);

  for (const factory of factories) {
    console.log(`📦 Factory: ${factory.name} (${factory.slug})`);
    let created = 0;
    let skipped = 0;
    for (const stage of DEFAULT_STAGES) {
      const exists = await prisma.projectStage.findUnique({
        where: { factoryId_slug: { factoryId: factory.id, slug: stage.slug } },
      });
      if (exists) {
        skipped += 1;
        continue;
      }
      await prisma.projectStage.create({
        data: { ...stage, factoryId: factory.id, isActive: true },
      });
      created += 1;
    }
    console.log(`  ✅ created ${created} stage template(s), skipped ${skipped} existing.`);
  }

  console.log("\n✨ Done. Now run:");
  console.log("   node scripts/backfill-stages.mjs");
  console.log("to instantiate stages for existing projects.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
