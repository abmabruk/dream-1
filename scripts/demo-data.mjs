import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PROJECT_CODE = "DEMO-PRJ-001";
const ORDER_CODE = "DEMO-ORD-001";

async function main() {
  console.log("\n🏭 جاري إنشاء بيانات تجريبية كاملة...\n");

  // ── (1) المصنع والمالك ──────────────────────────────────────────
  // بحث مرن: نبدأ من الإيميل اللي يستخدمه المالك للدخول
  const owner = await prisma.user.findFirst({
    where: { email: "owner@dream1.local" },
  }) ?? await prisma.user.findFirst({
    where: { role: "OWNER" },
  });
  if (!owner) {
    console.log("\nالمستخدمون الموجودون:");
    const allUsers = await prisma.user.findMany({ select: { email: true, role: true, firstName: true } });
    console.log(allUsers);
    console.error("\n❌ ما لقيت مستخدم. شغّل أولاً: npm run db:seed");
    process.exit(1);
  }
  const factory = await prisma.factory.findUnique({ where: { id: owner.factoryId } });
  if (!factory) {
    console.error("❌ ما لقيت المصنع المرتبط بالمستخدم");
    process.exit(1);
  }
  console.log(`✅ المصنع: ${factory.name}`);
  console.log(`✅ المالك: ${owner.firstName} ${owner.lastName}\n`);

  // ── (2) العميل ──────────────────────────────────────────────────
  let customer = await prisma.customer.findFirst({
    where: { factoryId: factory.id, name: "شركة الخليج للمكاتب" },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        factoryId: factory.id,
        name: "شركة الخليج للمكاتب",
        phone: "+966500000001",
        email: "info@gulf-offices.test",
        city: "الرياض",
        district: "العليا",
      },
    });
  }
  console.log(`✅ العميل: ${customer.name}`);

  // ── (3) الطلب (المبيعات — quotedAmount هو مبلغ البيع للعميل) ─────
  let order = await prisma.order.findFirst({
    where: { factoryId: factory.id, code: ORDER_CODE },
  });
  if (order) {
    console.log(`ℹ️  الطلب ${ORDER_CODE} موجود — أحذفه وأعيد بناءه...`);
    await prisma.order.delete({ where: { id: order.id } });
  }
  order = await prisma.order.create({
    data: {
      factoryId: factory.id,
      customerId: customer.id,
      ownerId: owner.id,
      createdById: owner.id,
      code: ORDER_CODE,
      title: "خزانة مكتب تنفيذي - خشب الجوز",
      description: "خزانة مكتب تنفيذي، خشب الجوز الطبيعي، ٦ أبواب، ٤ أدراج، يد نحاسي",
      quotedAmount: "28000.00",
      status: "APPROVED",
      targetDate: new Date(Date.now() + 14 * 86400 * 1000),
      approvedAt: new Date(),
    },
  });
  console.log(`✅ الطلب: ${order.code} — ${order.title} (${order.quotedAmount} ر.س)`);

  // ── (4) المشروع ─────────────────────────────────────────────────
  let project = await prisma.project.findFirst({
    where: { factoryId: factory.id, code: PROJECT_CODE },
  });
  if (project) {
    console.log(`ℹ️  المشروع ${PROJECT_CODE} موجود — أحذفه وأعيد بناءه...`);
    await prisma.project.delete({ where: { id: project.id } });
  }
  project = await prisma.project.create({
    data: {
      factoryId: factory.id,
      orderId: order.id,
      ownerUserId: owner.id,
      code: PROJECT_CODE,
      name: "تنفيذ خزانة المكتب التنفيذي",
      description: "تنفيذ كامل من القياس للتركيب — خزانة بـ ٦ أبواب و ٤ أدراج",
      status: "IN_PROGRESS",
      priority: "HIGH",
      startDate: new Date(Date.now() - 3 * 86400 * 1000),
      dueDate: new Date(Date.now() + 11 * 86400 * 1000),
    },
  });
  console.log(`✅ المشروع: ${project.code} — ${project.name}`);

  await prisma.projectActivity.create({
    data: {
      factoryId: factory.id,
      projectId: project.id,
      actorUserId: owner.id,
      type: "PROJECT_CREATED",
      message: `أُنشئ المشروع ${project.code}`,
    },
  });

  // ── (5) المهام (٧ مهام في كل مراحل العمل) ───────────────────────
  const taskDefs = [
    { title: "أخذ المقاسات في موقع العميل",  status: "DONE",              priority: "HIGH",   sortOrder: 0, completedAt: new Date(Date.now() - 2 * 86400 * 1000) },
    { title: "رسم التصميم النهائي والاعتماد", status: "DONE",              priority: "HIGH",   sortOrder: 1, completedAt: new Date(Date.now() - 1 * 86400 * 1000) },
    { title: "تجهيز ألواح خشب الجوز",          status: "IN_PROGRESS",       priority: "HIGH",   sortOrder: 2 },
    { title: "قص ونشر الألواح",                 status: "PLANNED_TODAY",     priority: "MEDIUM", sortOrder: 3 },
    { title: "تركيب المفصلات والمقابض",         status: "BACKLOG",           priority: "MEDIUM", sortOrder: 4 },
    { title: "الدهان والتلميع النهائي",         status: "BACKLOG",           priority: "MEDIUM", sortOrder: 5 },
    { title: "التركيب في موقع العميل",          status: "BACKLOG",           priority: "URGENT", sortOrder: 6, requiresApproval: true, approvalStatus: "PENDING" },
  ];
  const tasks = [];
  for (const t of taskDefs) {
    const task = await prisma.projectTask.create({
      data: {
        factoryId: factory.id,
        projectId: project.id,
        assignedToUserId: owner.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        sortOrder: t.sortOrder,
        requiresApproval: t.requiresApproval ?? false,
        approvalStatus: t.approvalStatus ?? "NOT_REQUIRED",
        completedAt: t.completedAt ?? null,
      },
    });
    tasks.push(task);
    await prisma.projectActivity.create({
      data: {
        factoryId: factory.id,
        projectId: project.id,
        taskId: task.id,
        actorUserId: owner.id,
        type: "TASK_CREATED",
        message: `أُضيفت مهمة: ${task.title}`,
      },
    });
  }
  console.log(`✅ ${tasks.length} مهام في كل مراحل العمل`);

  // ── (6) طابور اليوم (مجدول لليوم) ──────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTasks = tasks.filter(t => t.status === "IN_PROGRESS" || t.status === "PLANNED_TODAY");
  for (let i = 0; i < todayTasks.length; i++) {
    await prisma.workQueueItem.create({
      data: {
        factoryId: factory.id,
        taskId: todayTasks[i].id,
        assignedToUserId: owner.id,
        workDate: today,
        position: i,
        status: todayTasks[i].status === "IN_PROGRESS" ? "IN_PROGRESS" : "PLANNED",
        startedAt: todayTasks[i].status === "IN_PROGRESS" ? new Date(Date.now() - 3600 * 1000) : null,
      },
    });
  }
  console.log(`✅ ${todayTasks.length} مهام في طابور اليوم`);

  // ── (7) التكاليف (إجمالي ~ ١١,٢٠٠ ر.س — هامش متوقع ~ ١٦,٨٠٠) ───
  const costDefs = [
    { category: "MATERIAL", amount: "5800.00", description: "ألواح خشب الجوز الطبيعي - ٨ ألواح",  vendorName: "متجر الخشب الفاخر",  daysAgo: 3 },
    { category: "MATERIAL", amount: "1200.00", description: "مفصلات نحاسية ومقابض",                  vendorName: "أدوات المنزل المتقدمة", daysAgo: 2 },
    { category: "MATERIAL", amount: "650.00",  description: "ورنيش ودهانات تشطيب",                   vendorName: "متجر الدهانات",          daysAgo: 1 },
    { category: "LABOR",    amount: "2800.00", description: "أجور النجارين - أسبوع",                  vendorName: null,                       daysAgo: 1 },
    { category: "SERVICE",  amount: "750.00",  description: "نقل المواد للورشة",                       vendorName: "نقل سريع",                daysAgo: 2 },
  ];
  for (const c of costDefs) {
    await prisma.projectCost.create({
      data: {
        factoryId: factory.id,
        projectId: project.id,
        category: c.category,
        amount: c.amount,
        currency: "SAR",
        description: c.description,
        vendorName: c.vendorName,
        incurredAt: new Date(Date.now() - c.daysAgo * 86400 * 1000),
        createdById: owner.id,
      },
    });
    await prisma.projectActivity.create({
      data: {
        factoryId: factory.id,
        projectId: project.id,
        actorUserId: owner.id,
        type: "COST_ADDED",
        message: `أُضيفت تكلفة: ${c.category} ${c.amount} ر.س — ${c.description}`,
      },
    });
  }
  const totalCost = costDefs.reduce((s, c) => s + parseFloat(c.amount), 0);
  console.log(`✅ ${costDefs.length} تكاليف مضافة (إجمالي: ${totalCost.toFixed(2)} ر.س)`);

  // ── (8) تعليقات على مهمة قيد التنفيذ ───────────────────────────
  const commentTask = tasks.find(t => t.status === "IN_PROGRESS");
  const commentDefs = [
    { body: "بدأنا بتجهيز اللوح الأول، الجودة ممتازة",                          hoursAgo: 8 },
    { body: "المورّد أكّد إن البقية وصلت اليوم — نقدر نسرّع",                    hoursAgo: 5 },
    { body: "@" + owner.firstName + " لازم نراجع المقاسات قبل القص",             hoursAgo: 2 },
  ];
  for (const c of commentDefs) {
    await prisma.taskComment.create({
      data: {
        factoryId: factory.id,
        taskId: commentTask.id,
        authorId: owner.id,
        body: c.body,
        createdAt: new Date(Date.now() - c.hoursAgo * 3600 * 1000),
      },
    });
    await prisma.projectActivity.create({
      data: {
        factoryId: factory.id,
        projectId: project.id,
        taskId: commentTask.id,
        actorUserId: owner.id,
        type: "COMMENT_ADDED",
        message: `تعليق: ${c.body.slice(0, 60)}${c.body.length > 60 ? "..." : ""}`,
      },
    });
  }
  console.log(`✅ ${commentDefs.length} تعليقات على مهمة "${commentTask.title}"`);

  // ── ملخص نهائي ──────────────────────────────────────────────────
  const margin = 28000 - totalCost;
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ تم بناء التجربة الكاملة!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📊 المبيعات: 28,000 ر.س | التكاليف: ${totalCost.toLocaleString()} ر.س | الهامش: ${margin.toLocaleString()} ر.س`);
  console.log("\nافتح في المتصفح:");
  console.log(`  📋 الـ Hub:        http://localhost:2500/app/projects/${project.id}`);
  console.log(`  💰 الماليات:       http://localhost:2500/app/finance`);
  console.log(`  ⚙️  العمليات:        http://localhost:2500/app/ops`);
  console.log(`  📺 شاشة المصنع:    http://localhost:2500/floor`);
  console.log("");
}

main()
  .catch((e) => { console.error("❌ خطأ:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
