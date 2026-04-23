import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import {
  AssignmentStatus,
  InquirySource,
  InquiryStage,
  OrderStatus,
  ProjectTaskStatus,
  TaskApprovalStatus,
  WorkQueueStatus,
  UserRole,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";

import {
  createIntegrationDatabase,
  disconnectGlobalPrisma,
  resetIntegrationDatabase,
} from "./integration-db";

type OrderServiceClass = typeof import("@/modules/orders/order.service").OrderService;
type UserServiceClass = typeof import("@/modules/users/user.service").UserService;
type NotificationServiceClass =
  typeof import("@/modules/notifications/notification.service").NotificationService;
type ProjectServiceClass =
  typeof import("@/modules/projects/project.service").ProjectService;

describe.sequential("database-backed service integration", () => {
  let prisma: PrismaClient;
  let databaseUrl: string;
  let cleanup: () => Promise<void>;
  let OrderService: OrderServiceClass;
  let UserService: UserServiceClass;
  let NotificationService: NotificationServiceClass;
  let ProjectService: ProjectServiceClass;

  beforeAll(async () => {
    const integrationDb = await createIntegrationDatabase();
    prisma = integrationDb.prisma;
    databaseUrl = integrationDb.databaseUrl;
    cleanup = integrationDb.cleanup;

    process.env.DATABASE_URL = databaseUrl;
    await disconnectGlobalPrisma();
    vi.resetModules();

    ({ OrderService } = await import("@/modules/orders/order.service"));
    ({ UserService } = await import("@/modules/users/user.service"));
    ({ NotificationService } = await import("@/modules/notifications/notification.service"));
    ({ ProjectService } = await import("@/modules/projects/project.service"));
  }, 30000);

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
  }, 30000);

  it("creates users in the correct factory with hashed passwords", async () => {
    const factory = await prisma.factory.create({
      data: {
        name: "Dream 1 Factory",
        slug: "dream-1-factory",
      },
    });
    const owner = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "owner@test.local",
        firstName: "Dream",
        lastName: "Owner",
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });

    const service = new UserService();
    const created = await service.create(
      factory.id,
      {
        userId: owner.id,
        role: "OWNER",
      },
      {
        firstName: "Sara",
        lastName: "Lead",
        email: "sara@test.local",
        phone: "+966500000010",
        role: "SUPERVISOR",
        password: "dream12345",
      }
    );

    const storedUser = await prisma.user.findUnique({
      where: {
        email: "sara@test.local",
      },
    });

    expect(created.role).toBe("SUPERVISOR");
    expect(created.status).toBe("ACTIVE");
    expect(storedUser?.factoryId).toBe(factory.id);
    expect(storedUser?.passwordHash).toBeTruthy();
    expect(storedUser?.passwordHash).not.toBe("dream12345");
    expect(storedUser?.passwordHash).toContain(":");
  });

  it("creates orders with factory-specific numbering and an audit event", async () => {
    const factory = await prisma.factory.create({
      data: {
        name: "Factory Alpha",
        slug: "factory-alpha",
        orderCodePrefix: "ALP",
      },
    });
    const owner = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "owner-alpha@test.local",
        firstName: "Alpha",
        lastName: "Owner",
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });
    const customer = await prisma.customer.create({
      data: {
        factoryId: factory.id,
        name: "Noura Boutique",
        phone: "+966500000011",
      },
    });

    const service = new OrderService();
    const order = await service.create(factory.id, owner.id, {
      customerId: customer.id,
      title: "Luxury abaya set",
      description: "Formal capsule collection",
      targetDate: "2026-04-10",
      quotedAmount: 4200,
    });

    const events = await prisma.orderEvent.findMany({
      where: {
        orderId: order.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(order.code).toBe("ALP-00001");
    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      factoryId: factory.id,
      orderId: order.id,
      actorId: owner.id,
      type: "CREATED",
      note: "Order created",
    });
  });

  it("rejects orders that point to a customer in another factory", async () => {
    const sourceFactory = await prisma.factory.create({
      data: {
        name: "Factory Source",
        slug: "factory-source",
      },
    });
    const foreignFactory = await prisma.factory.create({
      data: {
        name: "Factory Foreign",
        slug: "factory-foreign",
      },
    });
    const owner = await prisma.user.create({
      data: {
        factoryId: sourceFactory.id,
        email: "owner-source@test.local",
        firstName: "Source",
        lastName: "Owner",
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });
    const foreignCustomer = await prisma.customer.create({
      data: {
        factoryId: foreignFactory.id,
        name: "Other Factory Customer",
        phone: "+966500000012",
      },
    });

    const service = new OrderService();

    await expect(
      service.create(sourceFactory.id, owner.id, {
        customerId: foreignCustomer.id,
        title: "Cross-factory order",
      })
    ).rejects.toThrow("Selected customer does not belong to this factory.");

    expect(
      await prisma.order.count({
        where: {
          factoryId: sourceFactory.id,
        },
      })
    ).toBe(0);
  });

  it("builds and persists notifications from real overdue, CRM, production, and portal data", async () => {
    const factory = await prisma.factory.create({
      data: {
        name: "Operations Factory",
        slug: "operations-factory",
        orderCodePrefix: "OPS",
      },
    });
    const manager = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "manager@test.local",
        firstName: "Maha",
        lastName: "Manager",
        role: UserRole.FACTORY_MANAGER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });
    const worker = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "worker@test.local",
        firstName: "Omar",
        lastName: "Worker",
        role: UserRole.WORKER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });
    const customer = await prisma.customer.create({
      data: {
        factoryId: factory.id,
        name: "Layla Couture",
        phone: "+966500000013",
      },
    });
    const overdueOrder = await prisma.order.create({
      data: {
        factoryId: factory.id,
        customerId: customer.id,
        createdById: manager.id,
        code: "OPS-00001",
        title: "Overdue bridal order",
        status: OrderStatus.APPROVED,
        targetDate: new Date("2026-03-01T00:00:00.000Z"),
      },
    });
    const quotedOrder = await prisma.order.create({
      data: {
        factoryId: factory.id,
        customerId: customer.id,
        createdById: manager.id,
        code: "OPS-00002",
        title: "Awaiting customer approval",
        status: OrderStatus.QUOTED,
      },
    });

    await prisma.orderPortalAccess.create({
      data: {
        factoryId: factory.id,
        orderId: quotedOrder.id,
        sharedById: manager.id,
      },
    });

    await prisma.inquiry.create({
      data: {
        factoryId: factory.id,
        assignedToId: manager.id,
        name: "Hessa",
        phone: "+966500000014",
        source: InquirySource.WHATSAPP,
        stage: InquiryStage.NEW,
        nextFollowUpAt: new Date("2026-03-10T00:00:00.000Z"),
      },
    });

    await prisma.assignment.create({
      data: {
        factoryId: factory.id,
        orderId: overdueOrder.id,
        workerId: worker.id,
        station: "Cutting",
        status: AssignmentStatus.BLOCKED,
      },
    });

    const service = new NotificationService();
    const feed = await service.getFeed({
      factoryId: factory.id,
      userId: manager.id,
      role: "FACTORY_MANAGER",
    });

    const persistedNotifications = await prisma.notification.findMany({
      where: {
        factoryId: factory.id,
        userId: manager.id,
        resolvedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(feed.summary).toMatchObject({
      totalActive: 4,
      unread: 4,
      read: 0,
      overdueOrders: 1,
      dueFollowUps: 1,
      blockedAssignments: 1,
      pendingApprovals: 1,
    });
    expect(feed.unread.map((item) => item.type).sort()).toEqual([
      "ASSIGNMENT_BLOCKED",
      "CRM_FOLLOW_UP_DUE",
      "CUSTOMER_APPROVAL_PENDING",
      "ORDER_OVERDUE",
    ]);
    expect(persistedNotifications).toHaveLength(4);

    await service.markRead(factory.id, manager.id, feed.unread[0].id);

    const refreshedFeed = await service.getFeed({
      factoryId: factory.id,
      userId: manager.id,
      role: "FACTORY_MANAGER",
    });
    const readNotification = await prisma.notification.findUnique({
      where: {
        id: feed.unread[0].id,
      },
    });

    expect(refreshedFeed.summary.unread).toBe(3);
    expect(refreshedFeed.summary.read).toBe(1);
    expect(readNotification?.status).toBe("READ");
    expect(readNotification?.readAt).not.toBeNull();
  });

  it("returns a 404 domain error when reading a missing notification", async () => {
    const factory = await prisma.factory.create({
      data: {
        name: "Factory Missing Note",
        slug: "factory-missing-note",
      },
    });
    const manager = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "manager-missing@test.local",
        firstName: "Lina",
        lastName: "Manager",
        role: UserRole.FACTORY_MANAGER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });

    const service = new NotificationService();

    await expect(
      service.markRead(factory.id, manager.id, "missing-notification")
    ).rejects.toEqual(new HttpError(404, "Notification not found."));
  });

  it("creates project tasks, queues them for today, and completes approval flow", async () => {
    const factory = await prisma.factory.create({
      data: {
        name: "Ops Factory",
        slug: "ops-factory",
      },
    });
    const manager = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "ops-manager@test.local",
        firstName: "Abeer",
        lastName: "Manager",
        role: UserRole.FACTORY_MANAGER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });
    const worker = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "ops-worker@test.local",
        firstName: "Salem",
        lastName: "Worker",
        role: UserRole.WORKER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });

    const service = new ProjectService();
    const project = await service.create(factory.id, manager.id, {
      name: "Ramadan uniforms",
      priority: "HIGH",
      dueDate: "2026-04-30",
      ownerUserId: manager.id,
    });
    const task = await service.createTask(factory.id, manager.id, {
      projectId: project.id,
      title: "Cut first batch",
      priority: "HIGH",
      assignedToUserId: worker.id,
      requiresApproval: true,
    });
    const queueItem = await service.addTaskToToday(factory.id, manager.id, {
      taskId: task.id,
      workDate: "2026-04-23",
      assignedToUserId: worker.id,
    });

    await service.updateQueueItem(factory.id, worker.id, {
      queueItemId: queueItem.id,
      status: "IN_PROGRESS",
    });
    await service.updateQueueItem(factory.id, worker.id, {
      queueItemId: queueItem.id,
      status: "WAITING_APPROVAL",
    });
    await service.reviewTask(
      factory.id,
      {
        userId: manager.id,
        role: UserRole.FACTORY_MANAGER,
      },
      {
        taskId: task.id,
        decision: "approve",
      }
    );

    const storedProject = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    const storedTask = await prisma.projectTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    const storedQueueItem = await prisma.workQueueItem.findUniqueOrThrow({
      where: { id: queueItem.id },
    });
    const activities = await prisma.projectActivity.findMany({
      where: {
        projectId: project.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(storedProject.status).toBe("COMPLETED");
    expect(storedTask.status).toBe(ProjectTaskStatus.DONE);
    expect(storedTask.approvalStatus).toBe(TaskApprovalStatus.APPROVED);
    expect(storedTask.approvedByUserId).toBe(manager.id);
    expect(storedQueueItem.status).toBe(WorkQueueStatus.DONE);
    expect(activities.map((activity) => activity.type)).toEqual([
      "PROJECT_CREATED",
      "TASK_CREATED",
      "TASK_ADDED_TO_TODAY",
      "QUEUE_STATUS_CHANGED",
      "QUEUE_STATUS_CHANGED",
      "TASK_APPROVED",
    ]);
  });

  it("blocks direct completion when a task still needs approval", async () => {
    const factory = await prisma.factory.create({
      data: {
        name: "Approval Factory",
        slug: "approval-factory",
      },
    });
    const manager = await prisma.user.create({
      data: {
        factoryId: factory.id,
        email: "approval-manager@test.local",
        firstName: "Nadia",
        lastName: "Manager",
        role: UserRole.FACTORY_MANAGER,
        status: UserStatus.ACTIVE,
        passwordHash: "seed-hash",
      },
    });

    const service = new ProjectService();
    const project = await service.create(factory.id, manager.id, {
      name: "Internal launch board",
    });
    const task = await service.createTask(factory.id, manager.id, {
      projectId: project.id,
      title: "Review finished board",
      requiresApproval: true,
    });
    const queueItem = await service.addTaskToToday(factory.id, manager.id, {
      taskId: task.id,
      workDate: "2026-04-23",
    });

    await expect(
      service.updateQueueItem(factory.id, manager.id, {
        queueItemId: queueItem.id,
        status: "DONE",
      })
    ).rejects.toEqual(
      new HttpError(409, "This task requires approval before it can be marked done.")
    );

    const storedTask = await prisma.projectTask.findUniqueOrThrow({
      where: { id: task.id },
    });

    expect(storedTask.status).toBe(ProjectTaskStatus.PLANNED_TODAY);
    expect(storedTask.approvalStatus).toBe(TaskApprovalStatus.NOT_REQUIRED);
  });
});
