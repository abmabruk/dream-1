import "server-only";

import {
  ProjectStatus,
  ProjectTaskStatus,
  TaskApprovalStatus,
  WorkQueueStatus,
} from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { WORK_QUEUE_STATUS_LABELS } from "./project-status";
import type {
  AddTaskToTodayInput,
  AttestDepositInput,
  CreateLocationInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  LocationItem,
  MoveTaskToProjectInput,
  OpsBoardData,
  ProjectDetail,
  ProjectListItem,
  ReorderQueueInput,
  RescheduleQueueItemInput,
  ReviewProjectTaskInput,
  StageInstanceDetail,
  StageInstanceItem,
  UpdateLocationInput,
  UpdateQueueItemInput,
} from "./project.schemas";

function displayName(user: { firstName: string; lastName: string } | null | undefined) {
  if (!user) {
    return null;
  }

  return `${user.firstName} ${user.lastName}`.trim();
}

function toBoardDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

async function resequenceQueueForDate(
  tx: PrismaTransaction,
  factoryId: string,
  workDate: Date,
  orderedQueueItemIds?: string[]
) {
  const queueItems = await tx.workQueueItem.findMany({
    where: {
      factoryId,
      workDate,
    },
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
    },
  });

  if (queueItems.length === 0) {
    return;
  }

  const currentIds = queueItems.map((item) => item.id);
  const finalIds = orderedQueueItemIds
    ? orderedQueueItemIds.filter((id) => currentIds.includes(id))
    : currentIds;

  for (const missingId of currentIds) {
    if (!finalIds.includes(missingId)) {
      finalIds.push(missingId);
    }
  }

  for (let index = 0; index < finalIds.length; index += 1) {
    await tx.workQueueItem.update({
      where: { id: finalIds[index] },
      data: {
        position: index + 1000,
      },
    });
  }

  for (let index = 0; index < finalIds.length; index += 1) {
    await tx.workQueueItem.update({
      where: { id: finalIds[index] },
      data: {
        position: index + 1,
      },
    });
  }
}

export class ProjectRepository {
  async listByFactory(factoryId: string, workDate: string): Promise<ProjectListItem[]> {
    const start = toBoardDate(workDate);
    const end = addDays(start, 1);

    const projects = await db.project.findMany({
      where: { factoryId },
      include: {
        owner: true,
        order: {
          select: {
            code: true,
          },
        },
        tasks: {
          include: {
            queueItems: {
              where: {
                workDate: {
                  gte: start,
                  lt: end,
                },
              },
            },
          },
        },
      },
      // sortOrder is a new field; cast until `prisma generate` is re-run on the user's machine.
      orderBy: [{ sortOrder: "asc" }, { priority: "desc" }, { createdAt: "desc" }] as never,
    });

    return projects.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      priority: project.priority,
      dueDate: project.dueDate?.toISOString() ?? null,
      ownerName: displayName(project.owner),
      orderCode: project.order?.code ?? null,
      openTaskCount: project.tasks.filter(
        (task) => !["DONE", "CANCELLED"].includes(task.status)
      ).length,
      queuedTodayCount: project.tasks.reduce(
        (count, task) => count + task.queueItems.length,
        0
      ),
      waitingApprovalCount: project.tasks.filter(
        (task) => task.status === "WAITING_APPROVAL"
      ).length,
      doneTaskCount: project.tasks.filter((task) => task.status === "DONE").length,
      totalTaskCount: project.tasks.length,
    }));
  }

  async listDetailedByFactory(factoryId: string, workDate: string): Promise<ProjectDetail[]> {
    const start = toBoardDate(workDate);
    const end = addDays(start, 1);

    // Fetch the IN_PROGRESS or first NOT_STARTED stage instance per project
    // so the floor screen and other consumers can display the current stage.
    const stageInstances = (await (db as never as {
      projectStageInstance: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    }).projectStageInstance.findMany({
      where: { factoryId },
      include: { stage: true },
      orderBy: [{ status: "asc" }, { stage: { sortOrder: "asc" } }],
    })) as Array<{
      id: string;
      projectId: string;
      status: string;
      startedAt: Date | null;
      completedAt: Date | null;
      stage: { id: string; slug: string; name: string; sortOrder: number; expectedDays: number | null };
    }>;
    const currentByProject = new Map<string, typeof stageInstances[number]>();
    for (const si of stageInstances) {
      // Prefer the IN_PROGRESS one; otherwise first NOT_STARTED by sortOrder.
      const existing = currentByProject.get(si.projectId);
      if (!existing) {
        currentByProject.set(si.projectId, si);
        continue;
      }
      if (si.status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") {
        currentByProject.set(si.projectId, si);
      }
    }

    const projects = await db.project.findMany({
      where: {
        factoryId,
        status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
      },
      include: {
        owner: true,
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            customer: { select: { id: true, name: true } },
          },
        },
        tasks: {
          include: {
            assignedTo: true,
            approvedBy: true,
            queueItems: {
              where: { workDate: { gte: start, lt: end } },
              include: { assignedTo: true },
              orderBy: { position: "asc" },
              take: 1,
            },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        activities: {
          include: { actor: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: [{ sortOrder: "asc" }, { priority: "desc" }, { createdAt: "desc" }] as never,
    });

    return projects.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate?.toISOString() ?? null,
      dueDate: project.dueDate?.toISOString() ?? null,
      completedAt: project.completedAt?.toISOString() ?? null,
      notes: project.notes,
      ownerName: displayName(project.owner),
      orderCode: project.order?.code ?? null,
      orderId: project.order?.id ?? null,
      customerId: project.order?.customerId ?? null,
      customerName: project.order?.customer?.name ?? null,
      inquiryId: null,
      tasks: project.tasks.map((task) => {
        const t = task as typeof task & { stageInstanceId: string | null };
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          requiresApproval: task.requiresApproval,
          approvalStatus: task.approvalStatus,
          dueDate: task.dueDate?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          assignedToUserId: task.assignedToUserId,
          assignedToName: displayName(task.assignedTo),
          approvedByName: displayName(task.approvedBy),
          rejectedReason: task.rejectedReason,
          sortOrder: task.sortOrder,
          updatedAt: task.updatedAt.toISOString(),
          stageInstanceId: t.stageInstanceId ?? null,
          stageName: null,
          locationId: (t as { locationId?: string | null }).locationId ?? null,
          locationName: null,
          locationCode: null,
          todayQueueItem: task.queueItems[0]
            ? {
                id: task.queueItems[0].id,
                status: task.queueItems[0].status,
                position: task.queueItems[0].position,
                assignedToName: displayName(task.queueItems[0].assignedTo),
                notes: task.queueItems[0].notes,
              }
            : null,
        };
      }),
      stageInstances: [],
      currentStageInstance: (() => {
        const cur = currentByProject.get(project.id);
        if (!cur) return null;
        return {
          id: cur.id,
          stageId: cur.stage.id,
          slug: cur.stage.slug,
          name: cur.stage.name,
          status: cur.status as never,
          sortOrder: cur.stage.sortOrder,
          startedAt: cur.startedAt?.toISOString() ?? null,
          completedAt: cur.completedAt?.toISOString() ?? null,
          expectedDays: cur.stage.expectedDays,
        } as never;
      })(),
      locations: [],
      activities: project.activities.map((activity) => {
        const a = activity as typeof activity & { stageInstanceId: string | null };
        return {
          id: activity.id,
          type: activity.type,
          message: activity.message,
          actorName: displayName(activity.actor),
          createdAt: activity.createdAt.toISOString(),
          stageInstanceId: a.stageInstanceId ?? null,
        };
      }),
    }));
  }

  async getById(
    factoryId: string,
    projectId: string,
    workDate: string
  ): Promise<ProjectDetail | null> {
    const start = toBoardDate(workDate);
    const end = addDays(start, 1);

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        factoryId,
      },
      include: {
        owner: true,
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            customer: { select: { id: true, name: true } },
          },
        },
        tasks: {
          include: {
            assignedTo: true,
            approvedBy: true,
            queueItems: {
              where: {
                workDate: {
                  gte: start,
                  lt: end,
                },
              },
              include: {
                assignedTo: true,
              },
              orderBy: {
                position: "asc",
              },
              take: 1,
            },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        activities: {
          include: {
            actor: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
      },
    });

    if (!project) {
      return null;
    }

    // Stage instances and locations are loaded via separate queries to keep the
    // existing project query unchanged. Prisma client may not yet have these
    // model types; the helper methods cast internally.
    const stageInstances = await this.listStageInstancesForProject(factoryId, projectId);
    const locations = await this.listLocations(factoryId, projectId);
    const currentStageInstance =
      stageInstances.find((s) => s.status === "IN_PROGRESS") ??
      stageInstances.find((s) => s.status === "NOT_STARTED") ??
      null;
    const stageNameById = new Map<string, string>(
      stageInstances.map((s) => [s.id, s.name]),
    );

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate?.toISOString() ?? null,
      dueDate: project.dueDate?.toISOString() ?? null,
      completedAt: project.completedAt?.toISOString() ?? null,
      notes: project.notes,
      ownerName: displayName(project.owner),
      orderCode: project.order?.code ?? null,
      orderId: project.order?.id ?? null,
      customerId: project.order?.customerId ?? null,
      customerName: project.order?.customer?.name ?? null,
      inquiryId: null,
      tasks: ((): ProjectDetail["tasks"] => {
        const locById = new Map<string, LocationItem>(locations.map((l) => [l.id, l]));
        return project.tasks.map((task) => {
        const t = task as typeof task & { stageInstanceId: string | null; locationId: string | null };
        const loc = t.locationId ? locById.get(t.locationId) ?? null : null;
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          requiresApproval: task.requiresApproval,
          approvalStatus: task.approvalStatus,
          dueDate: task.dueDate?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          assignedToUserId: task.assignedToUserId,
          assignedToName: displayName(task.assignedTo),
          approvedByName: displayName(task.approvedBy),
          rejectedReason: task.rejectedReason,
          sortOrder: task.sortOrder,
          updatedAt: task.updatedAt.toISOString(),
          stageInstanceId: t.stageInstanceId ?? null,
          stageName: t.stageInstanceId ? stageNameById.get(t.stageInstanceId) ?? null : null,
          locationId: t.locationId ?? null,
          locationName: loc?.name ?? null,
          locationCode: loc?.code ?? null,
          todayQueueItem: task.queueItems[0]
            ? {
                id: task.queueItems[0].id,
                status: task.queueItems[0].status,
                position: task.queueItems[0].position,
                assignedToName: displayName(task.queueItems[0].assignedTo),
                notes: task.queueItems[0].notes,
              }
            : null,
        };
      });
      })(),
      stageInstances,
      currentStageInstance,
      locations,
      activities: project.activities.map((activity) => {
        const a = activity as typeof activity & { stageInstanceId: string | null };
        return {
          id: activity.id,
          type: activity.type,
          message: activity.message,
          actorName: displayName(activity.actor),
          createdAt: activity.createdAt.toISOString(),
          stageInstanceId: a.stageInstanceId ?? null,
        };
      }),
    };
  }

  async createProject(factoryId: string, actorUserId: string, input: CreateProjectInput) {
    const factory = await db.factory.findUnique({
      where: { id: factoryId },
      select: { slug: true },
    });

    if (!factory) {
      throw new Error("Factory not found.");
    }

    const projectCount = await db.project.count({ where: { factoryId } });
    const code = `PRJ-${String(projectCount + 1).padStart(5, "0")}`;

    return db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          factoryId,
          orderId: input.orderId || null,
          ownerUserId: input.ownerUserId || null,
          code,
          name: input.name,
          description: input.description || null,
          priority: input.priority,
          startDate: input.startDate ? new Date(input.startDate) : null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes || null,
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: project.id,
        actorUserId,
        type: "PROJECT_CREATED",
        message: `أُنشئ المشروع ${project.code}.`,
      });

      // Auto-instantiate stages from active templates for this factory.
      // The Prisma client may not yet have the new model types if `prisma generate`
      // hasn't been re-run on the user's machine, so we cast to `never` defensively.
      const stages = await (tx as never as {
        projectStage: {
          findMany: (args: unknown) => Promise<Array<{
            id: string;
            sortOrder: number;
            ownerRole: string | null;
          }>>;
        };
      }).projectStage.findMany({
        where: { factoryId, isActive: true },
        orderBy: { sortOrder: "asc" },
      });

      for (const stage of stages) {
        await (tx as never as {
          projectStageInstance: {
            create: (args: unknown) => Promise<{ id: string }>;
          };
        }).projectStageInstance.create({
          data: {
            factoryId,
            projectId: project.id,
            stageId: stage.id,
            status: "NOT_STARTED",
          },
        });
      }

      // Create the default Main Location.
      await (tx as never as {
        location: {
          create: (args: unknown) => Promise<{ id: string }>;
        };
      }).location.create({
        data: {
          factoryId,
          projectId: project.id,
          name: "الموقع الرئيسي",
          sortOrder: 0,
        },
      });

      return project;
    });
  }

  async createTask(factoryId: string, actorUserId: string, input: CreateProjectTaskInput) {
    return db.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          id: input.projectId,
          factoryId,
        },
      });

      if (!project) {
        throw new Error("Project not found.");
      }

      const sortOrder = await tx.projectTask.count({
        where: {
          factoryId,
          projectId: input.projectId,
        },
      });

      const task = await tx.projectTask.create({
        data: {
          factoryId,
          projectId: input.projectId,
          title: input.title,
          description: input.description || null,
          priority: input.priority,
          assignedToUserId: input.assignedToUserId || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          requiresApproval: input.requiresApproval,
          approvalStatus: input.requiresApproval
            ? TaskApprovalStatus.NOT_REQUIRED
            : TaskApprovalStatus.NOT_REQUIRED,
          sortOrder,
          ...(input.stageInstanceId
            ? { stageInstanceId: input.stageInstanceId }
            : {}),
          ...(input.locationId
            ? { locationId: input.locationId }
            : {}),
        } as never,
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: input.projectId,
        taskId: task.id,
        stageInstanceId: input.stageInstanceId ?? null,
        actorUserId,
        type: "TASK_CREATED",
        message: `أُضيفت المهمة "${task.title}" إلى المشروع ${project.code}.`,
      });

      await this.refreshProjectStatus(tx, project.id);

      return task;
    });
  }

  async addTaskToToday(factoryId: string, actorUserId: string, input: AddTaskToTodayInput) {
    return db.$transaction(async (tx) => {
      const task = await tx.projectTask.findFirst({
        where: {
          id: input.taskId,
          factoryId,
        },
        include: {
          project: true,
        },
      });

      if (!task) {
        throw new Error("Task not found.");
      }

      const workDate = toBoardDate(input.workDate);
      const existing = await tx.workQueueItem.findFirst({
        where: {
          taskId: task.id,
          workDate,
        },
      });

      if (existing) {
        throw new Error("This task is already in today's queue.");
      }

      const maxPosition = await tx.workQueueItem.aggregate({
        where: {
          factoryId,
          workDate,
        },
        _max: {
          position: true,
        },
      });

      const queueItem = await tx.workQueueItem.create({
        data: {
          factoryId,
          taskId: task.id,
          workDate,
          position: (maxPosition._max.position ?? 0) + 1,
          assignedToUserId: input.assignedToUserId || task.assignedToUserId || null,
          notes: input.notes || null,
        },
      });

      if (input.beforeQueueItemId) {
        const targetItems = await tx.workQueueItem.findMany({
          where: {
            factoryId,
            workDate,
          },
          orderBy: {
            position: "asc",
          },
          select: {
            id: true,
          },
        });
        const targetIds = targetItems
          .map((item) => item.id)
          .filter((id) => id !== queueItem.id);
        const beforeIndex = targetIds.indexOf(input.beforeQueueItemId);

        if (beforeIndex >= 0) {
          targetIds.splice(beforeIndex, 0, queueItem.id);
        } else {
          targetIds.push(queueItem.id);
        }

        await resequenceQueueForDate(tx, factoryId, workDate, targetIds);
      }

      await tx.projectTask.update({
        where: {
          id: task.id,
        },
        data: {
          status: ProjectTaskStatus.PLANNED_TODAY,
          assignedToUserId: input.assignedToUserId || task.assignedToUserId || null,
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: task.projectId,
        taskId: task.id,
        actorUserId,
        type: "TASK_ADDED_TO_TODAY",
        message: `أُضيفت المهمة "${task.title}" إلى قائمة اليوم.`,
      });

      await this.refreshProjectStatus(tx, task.projectId);

      return queueItem;
    });
  }

  async reorderQueue(factoryId: string, actorUserId: string, input: ReorderQueueInput) {
    return db.$transaction(async (tx) => {
      const workDate = toBoardDate(input.workDate);
      const existing = await tx.workQueueItem.findMany({
        where: {
          factoryId,
          workDate,
        },
        select: {
          id: true,
          task: {
            select: {
              projectId: true,
              title: true,
            },
          },
        },
      });

      if (existing.length === 0) {
        throw new Error("No queue items found for this date.");
      }

      await resequenceQueueForDate(tx, factoryId, workDate, input.orderedQueueItemIds);

      const firstItem = existing.find((item) => item.id === input.orderedQueueItemIds[0]) ?? existing[0];
      await this.createActivity(tx, {
        factoryId,
        projectId: firstItem.task.projectId,
        actorUserId,
        type: "QUEUE_REORDERED",
        message: `أُعيد ترتيب قائمة اليوم بتاريخ ${input.workDate}.`,
      });

      return tx.workQueueItem.findMany({
        where: {
          factoryId,
          workDate,
        },
        orderBy: {
          position: "asc",
        },
      });
    });
  }

  async rescheduleQueueItem(
    factoryId: string,
    actorUserId: string,
    input: RescheduleQueueItemInput
  ) {
    return db.$transaction(async (tx) => {
      const queueItem = await tx.workQueueItem.findFirst({
        where: {
          id: input.queueItemId,
          factoryId,
        },
        include: {
          task: true,
        },
      });

      if (!queueItem) {
        throw new Error("Queue item not found.");
      }

      const targetDate = toBoardDate(input.targetDate);
      const currentDate = queueItem.workDate;
      const duplicate = await tx.workQueueItem.findFirst({
        where: {
          taskId: queueItem.taskId,
          workDate: targetDate,
          id: {
            not: queueItem.id,
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error("This task is already scheduled for that day.");
      }

      const targetCount = await tx.workQueueItem.count({
        where: {
          factoryId,
          workDate: targetDate,
        },
      });

      await tx.workQueueItem.update({
        where: {
          id: queueItem.id,
        },
        data: {
          workDate: targetDate,
          position: targetCount + 1,
        },
      });

      await resequenceQueueForDate(tx, factoryId, currentDate);

      const targetItems = await tx.workQueueItem.findMany({
        where: {
          factoryId,
          workDate: targetDate,
        },
        orderBy: {
          position: "asc",
        },
        select: {
          id: true,
        },
      });
      const targetIds = targetItems.map((item) => item.id).filter((id) => id !== queueItem.id);
      const beforeIndex = input.beforeQueueItemId
        ? targetIds.indexOf(input.beforeQueueItemId)
        : -1;

      if (beforeIndex >= 0) {
        targetIds.splice(beforeIndex, 0, queueItem.id);
      } else {
        targetIds.push(queueItem.id);
      }

      await resequenceQueueForDate(tx, factoryId, targetDate, targetIds);

      await this.createActivity(tx, {
        factoryId,
        projectId: queueItem.task.projectId,
        taskId: queueItem.taskId,
        actorUserId,
        type: "QUEUE_REORDERED",
        message: `نُقلت المهمة "${queueItem.task.title}" إلى تاريخ ${input.targetDate}.`,
      });

      return tx.workQueueItem.findUniqueOrThrow({
        where: {
          id: queueItem.id,
        },
      });
    });
  }

  async moveQueueItem(
    factoryId: string,
    actorUserId: string,
    queueItemId: string,
    direction: "up" | "down"
  ) {
    return db.$transaction(async (tx) => {
      const queueItem = await tx.workQueueItem.findFirst({
        where: {
          id: queueItemId,
          factoryId,
        },
        include: {
          task: true,
        },
      });

      if (!queueItem) {
        throw new Error("Queue item not found.");
      }

      const neighbor = await tx.workQueueItem.findFirst({
        where: {
          factoryId,
          workDate: queueItem.workDate,
          position:
            direction === "up"
              ? { lt: queueItem.position }
              : { gt: queueItem.position },
        },
        orderBy: {
          position: direction === "up" ? "desc" : "asc",
        },
      });

      if (!neighbor) {
        return queueItem;
      }

      await tx.workQueueItem.update({
        where: { id: queueItem.id },
        data: { position: neighbor.position },
      });

      await tx.workQueueItem.update({
        where: { id: neighbor.id },
        data: { position: queueItem.position },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: queueItem.task.projectId,
        taskId: queueItem.taskId,
        actorUserId,
        type: "QUEUE_REORDERED",
        message: `نُقلت المهمة "${queueItem.task.title}" ${direction === "up" ? "لأعلى" : "لأسفل"} في قائمة اليوم.`,
      });

      return tx.workQueueItem.findUniqueOrThrow({
        where: { id: queueItem.id },
      });
    });
  }

  async updateQueueItem(
    factoryId: string,
    actorUserId: string,
    input: UpdateQueueItemInput
  ) {
    return db.$transaction(async (tx) => {
      const queueItem = await tx.workQueueItem.findFirst({
        where: {
          id: input.queueItemId,
          factoryId,
        },
        include: {
          task: true,
        },
      });

      if (!queueItem) {
        throw new Error("Queue item not found.");
      }

      if (
        input.status === WorkQueueStatus.DONE &&
        queueItem.task.requiresApproval &&
        queueItem.task.approvalStatus !== TaskApprovalStatus.APPROVED
      ) {
        throw new HttpError(
          409,
          "This task requires approval before it can be marked done."
        );
      }

      const nextTaskStatus = this.mapQueueStatusToTaskStatus(input.status);
      const completedAt =
        input.status === WorkQueueStatus.DONE ? new Date() : null;
      const startedAt =
        input.status === WorkQueueStatus.IN_PROGRESS && !queueItem.startedAt
          ? new Date()
          : queueItem.startedAt;

      await tx.workQueueItem.update({
        where: {
          id: queueItem.id,
        },
        data: {
          status: input.status,
          notes: input.notes || queueItem.notes,
          startedAt,
          completedAt,
        },
      });

      await tx.projectTask.update({
        where: {
          id: queueItem.taskId,
        },
        data: {
          status: nextTaskStatus,
          completedAt:
            input.status === WorkQueueStatus.DONE ? new Date() : null,
          approvalStatus:
            input.status === WorkQueueStatus.WAITING_APPROVAL
              ? TaskApprovalStatus.PENDING
              : queueItem.task.approvalStatus,
          rejectedReason:
            input.status === WorkQueueStatus.WAITING_APPROVAL
              ? null
              : queueItem.task.rejectedReason,
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: queueItem.task.projectId,
        taskId: queueItem.taskId,
        actorUserId,
        type: "QUEUE_STATUS_CHANGED",
        message: `نُقلت المهمة "${queueItem.task.title}" إلى: ${WORK_QUEUE_STATUS_LABELS[input.status as keyof typeof WORK_QUEUE_STATUS_LABELS] ?? input.status}.`,
      });

      await this.refreshProjectStatus(tx, queueItem.task.projectId);

      return tx.workQueueItem.findUniqueOrThrow({
        where: { id: queueItem.id },
      });
    });
  }

  async reviewTask(factoryId: string, actorUserId: string, input: ReviewProjectTaskInput) {
    return db.$transaction(async (tx) => {
      const task = await tx.projectTask.findFirst({
        where: {
          id: input.taskId,
          factoryId,
        },
        include: {
          project: true,
          queueItems: {
            where: {
              status: WorkQueueStatus.WAITING_APPROVAL,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });

      if (!task) {
        throw new Error("Task not found.");
      }

      if (!task.requiresApproval) {
        throw new Error("This task does not require approval.");
      }

      if (task.status !== ProjectTaskStatus.WAITING_APPROVAL) {
        throw new Error("Task is not waiting for approval.");
      }

      const queueItem = task.queueItems[0] ?? null;
      const approved = input.decision === "approve";

      await tx.projectTask.update({
        where: {
          id: task.id,
        },
        data: {
          status: approved ? ProjectTaskStatus.DONE : ProjectTaskStatus.IN_PROGRESS,
          approvalStatus: approved
            ? TaskApprovalStatus.APPROVED
            : TaskApprovalStatus.REJECTED,
          approvedByUserId: approved ? actorUserId : null,
          approvedAt: approved ? new Date() : null,
          completedAt: approved ? new Date() : null,
          rejectedReason: approved ? null : input.note || "Rejected for revision.",
        },
      });

      if (queueItem) {
        await tx.workQueueItem.update({
          where: {
            id: queueItem.id,
          },
          data: {
            status: approved ? WorkQueueStatus.DONE : WorkQueueStatus.IN_PROGRESS,
            completedAt: approved ? new Date() : null,
          },
        });
      }

      await this.createActivity(tx, {
        factoryId,
        projectId: task.projectId,
        taskId: task.id,
        actorUserId,
        type: approved ? "TASK_APPROVED" : "TASK_REJECTED",
        message: approved
          ? `Task "${task.title}" was approved.`
          : `Task "${task.title}" was rejected for revision.`,
      });

      await this.refreshProjectStatus(tx, task.projectId);

      return tx.projectTask.findUniqueOrThrow({
        where: { id: task.id },
      });
    });
  }

  async getOpsBoard(factoryId: string, workDate: string): Promise<OpsBoardData> {
    const start = toBoardDate(workDate);
    const end = addDays(start, 1);

    const [queueItems, projects, forgottenTasks] = await Promise.all([
      db.workQueueItem.findMany({
        where: {
          factoryId,
          workDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          assignedTo: true,
          task: {
            include: {
              project: true,
            },
          },
        },
        orderBy: {
          position: "asc",
        },
      }),
      db.project.findMany({
        where: {
          factoryId,
          status: {
            notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
          },
        },
        include: {
          owner: true,
          tasks: {
            include: {
              queueItems: {
                where: {
                  workDate: {
                    gte: start,
                    lt: end,
                  },
                },
              },
            },
          },
        },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 12,
      }),
      db.projectTask.findMany({
        where: {
          factoryId,
          status: {
            in: [ProjectTaskStatus.BACKLOG, ProjectTaskStatus.BLOCKED],
          },
        },
        include: {
          project: true,
          assignedTo: true,
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
        take: 12,
      }),
    ]);

    return {
      date: workDate,
      summary: {
        total: queueItems.length,
        overdue: forgottenTasks.filter((task) => task.dueDate && task.dueDate < start).length,
        waitingApproval: queueItems.filter(
          (item) => item.status === WorkQueueStatus.WAITING_APPROVAL
        ).length,
        blocked: queueItems.filter((item) => item.status === WorkQueueStatus.BLOCKED).length,
        done: queueItems.filter((item) => item.status === WorkQueueStatus.DONE).length,
      },
      queue: queueItems.map((item) => ({
        id: item.id,
        position: item.position,
        status: item.status,
        notes: item.notes,
        assignedToName: displayName(item.assignedTo),
        assignedToUserId: item.assignedToUserId,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        task: {
          id: item.task.id,
          title: item.task.title,
          description: item.task.description,
          priority: item.task.priority,
          requiresApproval: item.task.requiresApproval,
          approvalStatus: item.task.approvalStatus,
          projectId: item.task.projectId,
          projectCode: item.task.project.code,
          projectName: item.task.project.name,
          updatedAt: item.task.updatedAt.toISOString(),
        },
      })),
      projects: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        description: project.description,
        ownerName: displayName(project.owner),
        dueDate: project.dueDate?.toISOString() ?? null,
        status: project.status,
        todayCount: project.tasks.reduce((count, task) => count + task.queueItems.length, 0),
        backlogCount: project.tasks.filter((task) => task.status === ProjectTaskStatus.BACKLOG)
          .length,
        waitingApprovalCount: project.tasks.filter(
          (task) => task.status === ProjectTaskStatus.WAITING_APPROVAL
        ).length,
      })),
      forgottenTasks: forgottenTasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate?.toISOString() ?? null,
        projectId: task.projectId,
        projectCode: task.project.code,
        projectName: task.project.name,
        assignedToName: displayName(task.assignedTo),
      })),
    };
  }

  async createActivity(
    tx: PrismaTransaction,
    input: {
      factoryId: string;
      projectId: string;
      taskId?: string;
      stageInstanceId?: string | null;
      actorUserId?: string | null;
      type:
        | "PROJECT_CREATED"
        | "PROJECT_UPDATED"
        | "TASK_CREATED"
        | "TASK_UPDATED"
        | "TASK_ADDED_TO_TODAY"
        | "QUEUE_REORDERED"
        | "QUEUE_STATUS_CHANGED"
        | "TASK_APPROVED"
        | "TASK_REJECTED"
        | "COST_ADDED"
        | "COST_DELETED"
        | "COMMENT_ADDED"
        | "ATTACHMENT_ADDED"
        | "ATTACHMENT_REMOVED"
        | "TASK_MENTION"
        | "STAGE_STARTED"
        | "STAGE_COMPLETED"
        | "STAGE_SKIPPED"
        | "STAGE_BLOCKED"
        | "DEPOSIT_ATTESTED"
        | "LOCATION_ADDED";
      message: string;
    }
  ) {
    return tx.projectActivity.create({
      data: {
        factoryId: input.factoryId,
        projectId: input.projectId,
        taskId: input.taskId,
        actorUserId: input.actorUserId ?? null,
        // The new ProjectActivityType values (STAGE_*, DEPOSIT_ATTESTED, LOCATION_ADDED)
        // aren't in the local generated Prisma client until `prisma generate` is re-run.
        type: input.type as never,
        message: input.message,
        ...(input.stageInstanceId
          ? { stageInstanceId: input.stageInstanceId }
          : {}),
      } as never,
    });
  }


  async updateTaskStatusByFactory(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    status: ProjectTaskStatus
  ) {
    return db.$transaction(async (tx) => {
      const task = await tx.projectTask.findFirst({
        where: { id: taskId, factoryId },
        include: {
          project: true,
          queueItems: {
            where: {
              workDate: {
                gte: toBoardDate(new Date().toISOString().slice(0, 10)),
                lt: addDays(toBoardDate(new Date().toISOString().slice(0, 10)), 1),
              },
            },
          },
        },
      });

      if (!task) {
        throw new Error("Task not found.");
      }

      const labelMap: Record<ProjectTaskStatus, string> = {
        BACKLOG: "البنك",
        PLANNED_TODAY: "مخطط اليوم",
        IN_PROGRESS: "قيد التنفيذ",
        WAITING_APPROVAL: "بانتظار الموافقة",
        BLOCKED: "متوقف",
        DONE: "منجز",
        CANCELLED: "ملغي",
      };

      const completedAt = status === ProjectTaskStatus.DONE ? new Date() : null;
      const approvalStatus =
        status === ProjectTaskStatus.WAITING_APPROVAL
          ? TaskApprovalStatus.PENDING
          : status === ProjectTaskStatus.DONE && task.requiresApproval
            ? TaskApprovalStatus.APPROVED
            : task.approvalStatus;

      await tx.projectTask.update({
        where: { id: task.id },
        data: {
          status,
          completedAt,
          approvalStatus,
        },
      });

      // Cascade to today's WorkQueueItem if the move implies it.
      const today = toBoardDate(new Date().toISOString().slice(0, 10));
      const tomorrow = addDays(today, 1);

      if (status === ProjectTaskStatus.PLANNED_TODAY) {
        const existing = await tx.workQueueItem.findFirst({
          where: {
            taskId: task.id,
            workDate: { gte: today, lt: tomorrow },
          },
        });

        if (!existing) {
          const maxPos = await tx.workQueueItem.aggregate({
            where: { factoryId, workDate: { gte: today, lt: tomorrow } },
            _max: { position: true },
          });
          await tx.workQueueItem.create({
            data: {
              factoryId,
              taskId: task.id,
              workDate: today,
              position: (maxPos._max.position ?? 0) + 1,
              assignedToUserId: task.assignedToUserId,
              status: WorkQueueStatus.PLANNED,
            },
          });
        } else {
          await tx.workQueueItem.update({
            where: { id: existing.id },
            data: { status: WorkQueueStatus.PLANNED },
          });
        }
      } else if (
        status === ProjectTaskStatus.IN_PROGRESS ||
        status === ProjectTaskStatus.WAITING_APPROVAL ||
        status === ProjectTaskStatus.DONE ||
        status === ProjectTaskStatus.BLOCKED ||
        status === ProjectTaskStatus.CANCELLED ||
        status === ProjectTaskStatus.BACKLOG
      ) {
        const existing = await tx.workQueueItem.findFirst({
          where: {
            taskId: task.id,
            workDate: { gte: today, lt: tomorrow },
          },
        });

        if (existing) {
          let mappedStatus: WorkQueueStatus = existing.status;
          if (status === ProjectTaskStatus.IN_PROGRESS) {
            mappedStatus = WorkQueueStatus.IN_PROGRESS;
          } else if (status === ProjectTaskStatus.WAITING_APPROVAL) {
            mappedStatus = WorkQueueStatus.WAITING_APPROVAL;
          } else if (status === ProjectTaskStatus.DONE) {
            mappedStatus = WorkQueueStatus.DONE;
          } else if (status === ProjectTaskStatus.BLOCKED) {
            mappedStatus = WorkQueueStatus.BLOCKED;
          } else if (status === ProjectTaskStatus.CANCELLED) {
            mappedStatus = WorkQueueStatus.CANCELLED;
          } else if (status === ProjectTaskStatus.BACKLOG) {
            mappedStatus = WorkQueueStatus.CANCELLED;
          }

          await tx.workQueueItem.update({
            where: { id: existing.id },
            data: {
              status: mappedStatus,
              completedAt: status === ProjectTaskStatus.DONE ? new Date() : existing.completedAt,
            },
          });
        }
      }

      await this.createActivity(tx, {
        factoryId,
        projectId: task.projectId,
        taskId: task.id,
        actorUserId,
        type: "TASK_UPDATED",
        message: `نُقلت المهمة إلى: ${labelMap[status]}`,
      });

      await this.refreshProjectStatus(tx, task.projectId);

      return tx.projectTask.findUniqueOrThrow({
        where: { id: task.id },
      });
    });
  }

  async refreshProjectStatus(tx: PrismaTransaction, projectId: string) {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    let nextStatus = project.status;
    let completedAt = project.completedAt;
    const activeTasks = project.tasks.filter((task) => task.status !== ProjectTaskStatus.CANCELLED);

    if (activeTasks.length === 0) {
      nextStatus = ProjectStatus.PLANNING;
      completedAt = null;
    } else if (activeTasks.every((task) => task.status === ProjectTaskStatus.DONE)) {
      nextStatus = ProjectStatus.COMPLETED;
      completedAt = new Date();
    } else if (activeTasks.some((task) => task.status === ProjectTaskStatus.BLOCKED)) {
      nextStatus = ProjectStatus.BLOCKED;
      completedAt = null;
    } else if (
      activeTasks.some(
        (task) =>
          task.status === ProjectTaskStatus.PLANNED_TODAY ||
          task.status === ProjectTaskStatus.IN_PROGRESS ||
          task.status === ProjectTaskStatus.WAITING_APPROVAL
      )
    ) {
      nextStatus = ProjectStatus.IN_PROGRESS;
      completedAt = null;
    } else {
      nextStatus = ProjectStatus.READY;
      completedAt = null;
    }

    return tx.project.update({
      where: { id: projectId },
      data: {
        status: nextStatus,
        completedAt,
      },
    });
  }

  private mapQueueStatusToTaskStatus(status: WorkQueueStatus) {
    switch (status) {
      case WorkQueueStatus.PLANNED:
        return ProjectTaskStatus.PLANNED_TODAY;
      case WorkQueueStatus.IN_PROGRESS:
        return ProjectTaskStatus.IN_PROGRESS;
      case WorkQueueStatus.WAITING_APPROVAL:
        return ProjectTaskStatus.WAITING_APPROVAL;
      case WorkQueueStatus.BLOCKED:
        return ProjectTaskStatus.BLOCKED;
      case WorkQueueStatus.DONE:
        return ProjectTaskStatus.DONE;
      case WorkQueueStatus.CANCELLED:
        return ProjectTaskStatus.CANCELLED;
    }
  }

  /**
   * Reorder projects within a factory by writing new sortOrder values.
   * Accepts a list of project IDs in the desired display order (top → bottom).
   * Any project not in the list keeps its existing sortOrder, but is appended
   * after the listed ones to avoid orphans floating to the top.
   */
  async reorderProjectsByFactory(
    factoryId: string,
    orderedIds: string[],
  ): Promise<void> {
    if (orderedIds.length === 0) return;

    // Verify all IDs belong to this factory before touching anything.
    const owned = await db.project.findMany({
      where: { factoryId, id: { in: orderedIds } },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((p) => p.id));
    const safeOrder = orderedIds.filter((id) => ownedSet.has(id));

    await db.$transaction(
      safeOrder.map((id, index) =>
        db.project.update({
          where: { id },
          data: { sortOrder: index } as never,
        }),
      ),
    );
  }


  // ============================================================
  // Stages: list, advance, start, attest deposit, list instances
  // ============================================================

  async getStagesForFactory(factoryId: string) {
    const dbAny = db as never as {
      projectStage: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          slug: string;
          name: string;
          description: string | null;
          ownerRole: string | null;
          sortOrder: number;
          isOptional: boolean;
          requiresDepositAttestation: boolean;
          expectedDays: number | null;
          isActive: boolean;
        }>>;
      };
    };
    return dbAny.projectStage.findMany({
      where: { factoryId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  private mapStageInstance(row: {
    id: string;
    stageId: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    ownerUserId: string | null;
    notes: string | null;
    depositAttested: boolean;
    depositAmount: { toString(): string } | null;
    depositReceivedAt: Date | null;
    depositMethod: string | null;
    depositReceiptUrl: string | null;
    depositNote: string | null;
    drawingsApproved: boolean;
    stage: {
      slug: string;
      name: string;
      description: string | null;
      sortOrder: number;
      isOptional: boolean;
      requiresDepositAttestation: boolean;
      expectedDays: number | null;
    };
    owner: { firstName: string; lastName: string } | null;
  }): StageInstanceItem {
    return {
      id: row.id,
      stageId: row.stageId,
      slug: row.stage.slug,
      name: row.stage.name,
      description: row.stage.description,
      sortOrder: row.stage.sortOrder,
      status: row.status as StageInstanceItem["status"],
      isOptional: row.stage.isOptional,
      requiresDepositAttestation: row.stage.requiresDepositAttestation,
      expectedDays: row.stage.expectedDays,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      ownerUserId: row.ownerUserId,
      ownerName: displayName(row.owner),
      notes: row.notes,
      depositAttested: row.depositAttested,
      depositAmount: row.depositAmount ? Number(row.depositAmount.toString()) : null,
      depositReceivedAt: row.depositReceivedAt?.toISOString() ?? null,
      depositMethod: row.depositMethod,
      depositReceiptUrl: row.depositReceiptUrl,
      depositNote: row.depositNote,
      drawingsApproved: row.drawingsApproved,
    };
  }

  async listStageInstancesForProject(
    factoryId: string,
    projectId: string
  ): Promise<StageInstanceItem[]> {
    const dbAny = db as never as {
      projectStageInstance: {
        findMany: (args: unknown) => Promise<Array<Parameters<ProjectRepository["mapStageInstance"]>[0]>>;
      };
    };
    const rows = await dbAny.projectStageInstance.findMany({
      where: { factoryId, projectId },
      include: { stage: true, owner: true },
      orderBy: { stage: { sortOrder: "asc" } },
    });
    return rows.map((row) => this.mapStageInstance(row));
  }

  /**
   * Backfill stage instances + a default location for a project that was
   * created before stages were enabled. Idempotent — projects that already
   * have stage instances or a location are skipped on the relevant axis.
   */
  async backfillProjectStages(factoryId: string, projectId: string, actorUserId: string) {
    const dbAny = db as never as {
      projectStage: {
        findMany: (args: unknown) => Promise<Array<{ id: string; sortOrder: number }>>;
      };
      projectStageInstance: {
        count: (args: unknown) => Promise<number>;
        create: (args: unknown) => Promise<{ id: string }>;
      };
      location: {
        count: (args: unknown) => Promise<number>;
        create: (args: unknown) => Promise<{ id: string }>;
      };
    };

    const stages = await dbAny.projectStage.findMany({
      where: { factoryId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    let createdInstances = 0;
    const existing = await dbAny.projectStageInstance.count({
      where: { projectId, factoryId },
    });
    if (existing === 0 && stages.length > 0) {
      for (const stage of stages) {
        await dbAny.projectStageInstance.create({
          data: {
            factoryId,
            projectId,
            stageId: stage.id,
            status: "NOT_STARTED",
          },
        });
        createdInstances += 1;
      }
    }

    let createdLocations = 0;
    const locCount = await dbAny.location.count({
      where: { projectId, factoryId },
    });
    if (locCount === 0) {
      await dbAny.location.create({
        data: {
          factoryId,
          projectId,
          name: "الموقع الرئيسي",
          sortOrder: 0,
        },
      });
      createdLocations += 1;
    }

    if (createdInstances > 0 || createdLocations > 0) {
      await db.$transaction(async (tx) => {
        await this.createActivity(tx, {
          factoryId,
          projectId,
          actorUserId,
          type: "STAGE_STARTED",
          message: `تمت تهيئة مراحل المشروع (${createdInstances} مرحلة).`,
        });
      });
    }

    return { createdInstances, createdLocations };
  }

  /**
   * Advance the given stage instance to COMPLETED and start the next stage.
   * Soft-gates: if the next stage requires a deposit attestation and the
   * current stage isn't attested, we throw a typed error so the service can
   * map it to a "DEPOSIT_REQUIRED" code.
   */
  async advanceStage(
    factoryId: string,
    projectId: string,
    fromStageInstanceId: string,
    actorUserId: string
  ) {
    const result = await db.$transaction(async (tx) => {
      const txAny = tx as never as {
        projectStageInstance: {
          findFirst: (args: unknown) => Promise<{
            id: string;
            stageId: string;
            depositAttested: boolean;
            stage: {
              sortOrder: number;
              name: string;
              requiresDepositAttestation: boolean;
            };
          } | null>;
          findMany: (args: unknown) => Promise<Array<{
            id: string;
            stageId: string;
            status: string;
            stage: {
              sortOrder: number;
              name: string;
              requiresDepositAttestation: boolean;
            };
          }>>;
          update: (args: unknown) => Promise<{ id: string }>;
        };
      };

      const current = await txAny.projectStageInstance.findFirst({
        where: { id: fromStageInstanceId, factoryId, projectId },
        include: { stage: true },
      });

      if (!current) {
        throw new Error("Stage instance not found.");
      }

      // Find the next stage (by sortOrder).
      const all = await txAny.projectStageInstance.findMany({
        where: { factoryId, projectId },
        include: { stage: true },
        orderBy: { stage: { sortOrder: "asc" } },
      });
      const next = all.find((row) => row.stage.sortOrder > current.stage.sortOrder);

      if (next && next.stage.requiresDepositAttestation && !current.depositAttested) {
        const err = new Error("DEPOSIT_REQUIRED");
        (err as unknown as { code?: string }).code = "DEPOSIT_REQUIRED";
        throw err;
      }

      await txAny.projectStageInstance.update({
        where: { id: current.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId,
        stageInstanceId: current.id,
        actorUserId,
        type: "STAGE_COMPLETED",
        message: `اكتملت المرحلة: ${current.stage.name}`,
      });

      if (next) {
        await txAny.projectStageInstance.update({
          where: { id: next.id },
          data: {
            status: "IN_PROGRESS",
            startedAt: next.status === "NOT_STARTED" ? new Date() : undefined,
          },
        });
        await this.createActivity(tx, {
          factoryId,
          projectId,
          stageInstanceId: next.id,
          actorUserId,
          type: "STAGE_STARTED",
          message: `بدأت المرحلة: ${next.stage.name}`,
        });
      }

      return { currentId: current.id, nextId: next?.id ?? null };
    });

    // Best-effort: notify owner / role for the newly-started stage.
    if (result.nextId) {
      try {
        await this.notifyStageStarted(factoryId, projectId, result.nextId);
      } catch {
        // Notifications must never break the advancement flow.
      }
    }

    return result;
  }

  /**
   * Write STAGE_STARTED notifications for the new IN_PROGRESS stage.
   * - If ownerUserId set → notify that user.
   * - Else → notify all factory users with the stage's ownerRole.
   * Silent on missing data; deduped per stage instance + recipient.
   */
  private async notifyStageStarted(
    factoryId: string,
    projectId: string,
    stageInstanceId: string,
  ) {
    const dbAny = db as never as {
      projectStageInstance: {
        findFirst: (args: unknown) => Promise<{
          id: string;
          ownerUserId: string | null;
          stage: { name: string; ownerRole: string | null };
          project: { id: string; code: string; name: string };
        } | null>;
      };
      user: {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>;
      };
      notification: {
        upsert: (args: unknown) => Promise<unknown>;
      };
    };

    const instance = await dbAny.projectStageInstance.findFirst({
      where: { id: stageInstanceId, factoryId, projectId },
      include: {
        stage: { select: { name: true, ownerRole: true } },
        project: { select: { id: true, code: true, name: true } },
      },
    });
    if (!instance) return;

    const recipients: string[] = [];
    if (instance.ownerUserId) {
      recipients.push(instance.ownerUserId);
    } else if (instance.stage.ownerRole) {
      const users = await dbAny.user.findMany({
        where: {
          factoryId,
          status: "ACTIVE",
          role: instance.stage.ownerRole,
        },
        select: { id: true },
      });
      for (const u of users) recipients.push(u.id);
    }

    const title = `بدأت مرحلة جديدة: ${instance.stage.name}`;
    const message = `المشروع ${instance.project.code}: ${instance.project.name}`;
    const href = `/app/projects/${instance.project.id}?tab=tasks`;
    const dedupeKey = `STAGE_STARTED:${stageInstanceId}`;

    for (const userId of recipients) {
      await dbAny.notification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey } },
        create: {
          factoryId,
          userId,
          type: "STAGE_STARTED",
          dedupeKey,
          title,
          message,
          href,
          entityType: "STAGE_INSTANCE",
          entityId: stageInstanceId,
        },
        update: {},
      });
    }
  }

  private async notifyDepositAttested(
    factoryId: string,
    projectId: string,
    stageInstanceId: string,
  ) {
    const dbAny = db as never as {
      project: {
        findFirst: (args: unknown) => Promise<{
          id: string;
          code: string;
          name: string;
        } | null>;
      };
      user: {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>;
      };
      notification: {
        upsert: (args: unknown) => Promise<unknown>;
      };
    };

    const project = await dbAny.project.findFirst({
      where: { id: projectId, factoryId },
      select: { id: true, code: true, name: true },
    });
    if (!project) return;

    const owners = await dbAny.user.findMany({
      where: { factoryId, status: "ACTIVE", role: "OWNER" },
      select: { id: true },
    });

    const title = `تم تأكيد العربون لمشروع ${project.code}`;
    const message = `${project.name}`;
    const href = `/app/projects/${project.id}?tab=finance`;
    const dedupeKey = `DEPOSIT_ATTESTED:${stageInstanceId}`;

    for (const owner of owners) {
      await dbAny.notification.upsert({
        where: { userId_dedupeKey: { userId: owner.id, dedupeKey } },
        create: {
          factoryId,
          userId: owner.id,
          type: "DEPOSIT_ATTESTED",
          dedupeKey,
          title,
          message,
          href,
          entityType: "STAGE_INSTANCE",
          entityId: stageInstanceId,
        },
        update: {},
      });
    }
  }

  async startStage(
    factoryId: string,
    stageInstanceId: string,
    actorUserId: string
  ) {
    return db.$transaction(async (tx) => {
      const txAny = tx as never as {
        projectStageInstance: {
          findFirst: (args: unknown) => Promise<{
            id: string;
            projectId: string;
            status: string;
            stage: { name: string };
          } | null>;
          update: (args: unknown) => Promise<{ id: string }>;
        };
      };

      const instance = await txAny.projectStageInstance.findFirst({
        where: { id: stageInstanceId, factoryId },
        include: { stage: true },
      });
      if (!instance) {
        throw new Error("Stage instance not found.");
      }

      await txAny.projectStageInstance.update({
        where: { id: instance.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: instance.projectId,
        stageInstanceId: instance.id,
        actorUserId,
        type: "STAGE_STARTED",
        message: `بدأت المرحلة: ${instance.stage.name}`,
      });

      return { id: instance.id };
    });
  }

  async attestDeposit(
    factoryId: string,
    stageInstanceId: string,
    actorUserId: string,
    input: AttestDepositInput
  ) {
    const result = await db.$transaction(async (tx) => {
      const txAny = tx as never as {
        projectStageInstance: {
          findFirst: (args: unknown) => Promise<{
            id: string;
            projectId: string;
            stage: { name: string };
          } | null>;
          update: (args: unknown) => Promise<{ id: string }>;
        };
      };

      const instance = await txAny.projectStageInstance.findFirst({
        where: { id: stageInstanceId, factoryId },
        include: { stage: true },
      });
      if (!instance) {
        throw new Error("Stage instance not found.");
      }

      await txAny.projectStageInstance.update({
        where: { id: instance.id },
        data: {
          depositAttested: true,
          depositAmount: input.amount ?? null,
          depositReceivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
          depositMethod: input.method ?? null,
          depositReceiptUrl: input.receiptUrl ?? null,
          depositNote: input.note ?? null,
          ...(input.drawingsApproved !== undefined
            ? { drawingsApproved: input.drawingsApproved }
            : {}),
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: instance.projectId,
        stageInstanceId: instance.id,
        actorUserId,
        type: "DEPOSIT_ATTESTED",
        message: `تم تأكيد استلام العربون لمرحلة: ${instance.stage.name}`,
      });

      return { id: instance.id, projectId: instance.projectId };
    });

    try {
      await this.notifyDepositAttested(factoryId, result.projectId, result.id);
    } catch {
      // Notifications never block business flow.
    }

    return { id: result.id };
  }

  // ============================================================
  // Locations
  // ============================================================

  async listLocations(factoryId: string, projectId: string): Promise<LocationItem[]> {
    const dbAny = db as never as {
      location: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          name: string;
          code: string | null;
          notes: string | null;
          sortOrder: number;
          isTemplate: boolean;
          quotedAmount: { toString(): string } | null;
        }>>;
      };
    };
    const rows = await dbAny.location.findMany({
      where: { factoryId, projectId },
      orderBy: { sortOrder: "asc" },
    });
    // Compute task counts per location in a single grouped query.
    const counts = await (db.projectTask as unknown as {
      groupBy: (args: unknown) => Promise<Array<{ locationId: string | null; _count: { _all: number } }>>;
    }).groupBy({
      by: ["locationId"],
      where: { factoryId, projectId },
      _count: { _all: true },
    });
    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c.locationId) countMap.set(c.locationId, c._count._all);
    }
    const costRows = await (db as never as { $queryRaw: (sql: TemplateStringsArray, ...args: string[]) => Promise<Array<{ locationId: string; total: string }>> }).$queryRaw`
  SELECT "locationId", SUM(amount)::text as total FROM "ProjectCost" WHERE "factoryId" = ${factoryId} AND "projectId" = ${projectId} AND "locationId" IS NOT NULL GROUP BY "locationId"`;
    const costMap = new Map<string, number>();
    for (const c of costRows) costMap.set(c.locationId, Number(c.total));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      notes: row.notes,
      sortOrder: row.sortOrder,
      isTemplate: row.isTemplate,
      taskCount: countMap.get(row.id) ?? 0,
      quotedAmount: row.quotedAmount ? Number(row.quotedAmount.toString()) : null,
      totalCost: costMap.get(row.id) ?? 0,
      profitLoss: row.quotedAmount ? Number(row.quotedAmount.toString()) - (costMap.get(row.id) ?? 0) : null,
    }));
  }

  async createLocation(
    factoryId: string,
    actorUserId: string,
    input: CreateLocationInput
  ) {
    return db.$transaction(async (tx) => {
      const txAny = tx as never as {
        location: {
          aggregate: (args: unknown) => Promise<{ _max: { sortOrder: number | null } }>;
          create: (args: unknown) => Promise<{ id: string; name: string }>;
        };
      };

      const max = await txAny.location.aggregate({
        where: { factoryId, projectId: input.projectId },
        _max: { sortOrder: true },
      });

      const location = await txAny.location.create({
        data: {
          factoryId,
          projectId: input.projectId,
          name: input.name,
          code: input.code ?? null,
          notes: input.notes ?? null,
          sortOrder: input.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
          isTemplate: input.isTemplate ?? false,
          ...(input.quotedAmount !== undefined && input.quotedAmount !== null
            ? { quotedAmount: input.quotedAmount }
            : {}),
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: input.projectId,
        actorUserId,
        type: "LOCATION_ADDED",
        message: `أُضيف موقع جديد: ${location.name}`,
      });

      return location;
    });
  }

  async cloneLocation(
    factoryId: string,
    actorUserId: string,
    sourceLocationId: string,
    targetProjectId: string,
    options: { count?: number; namePrefix?: string } = {},
  ) {
    return db.$transaction(async (tx) => {
      const txAny = tx as never as {
        location: {
          findFirst: (args: unknown) => Promise<{
            id: string;
            name: string;
            code: string | null;
            notes: string | null;
          } | null>;
          aggregate: (args: unknown) => Promise<{ _max: { sortOrder: number | null } }>;
          create: (args: unknown) => Promise<{ id: string; name: string }>;
        };
      };

      const source = await txAny.location.findFirst({
        where: { id: sourceLocationId, factoryId },
      });
      if (!source) {
        throw new Error("Source location not found.");
      }
      const max = await txAny.location.aggregate({
        where: { factoryId, projectId: targetProjectId },
        _max: { sortOrder: true },
      });

      const count = Math.max(1, Math.min(20, options.count ?? 1));
      const prefix = options.namePrefix?.trim();
      const baseSort = (max._max.sortOrder ?? -1) + 1;
      const created: { id: string; name: string }[] = [];
      for (let i = 0; i < count; i += 1) {
        const name = prefix
          ? `${prefix} ${i + 1}`
          : count > 1
            ? `${source.name} (${i + 1})`
            : `${source.name} (نسخة)`;
        const cloned = await txAny.location.create({
          data: {
            factoryId,
            projectId: targetProjectId,
            name,
            code: source.code,
            notes: source.notes,
            sortOrder: baseSort + i,
          },
        });
        created.push(cloned);
        await this.createActivity(tx, {
          factoryId,
          projectId: targetProjectId,
          actorUserId,
          type: "LOCATION_ADDED",
          message: `استنسخ موقع جديد: ${cloned.name}`,
        });
      }

      return created.length === 1 ? created[0] : { count: created.length, ids: created.map((c) => c.id) };
    });
  }

  async updateLocation(
    factoryId: string,
    actorUserId: string,
    input: UpdateLocationInput
  ) {
    const dbAny = db as never as {
      location: {
        findFirst: (args: unknown) => Promise<{
          id: string;
          projectId: string;
        } | null>;
        update: (args: unknown) => Promise<{ id: string }>;
      };
    };
    const existing = await dbAny.location.findFirst({
      where: { id: input.locationId, factoryId },
    });
    if (!existing) {
      throw new Error("Location not found.");
    }
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isTemplate !== undefined) data.isTemplate = input.isTemplate;
    if (input.quotedAmount !== undefined) data.quotedAmount = input.quotedAmount;
    const updated = await dbAny.location.update({
      where: { id: input.locationId },
      data,
    });
    void actorUserId;
    return updated;
  }

  async deleteLocation(
    factoryId: string,
    actorUserId: string,
    locationId: string,
  ) {
    return db.$transaction(async (tx) => {
      const txAny = tx as never as {
        location: {
          findFirst: (args: unknown) => Promise<{
            id: string;
            projectId: string;
            name: string;
          } | null>;
          delete: (args: unknown) => Promise<{ id: string }>;
        };
      };
      const loc = await txAny.location.findFirst({
        where: { id: locationId, factoryId },
      });
      if (!loc) {
        throw Object.assign(new Error("Location not found."), { code: "NOT_FOUND" });
      }
      const taskCount = await tx.projectTask.count({
        where: { factoryId, projectId: loc.projectId, locationId } as never,
      });
      if (taskCount > 0) {
        throw Object.assign(
          new Error("Location has tasks. Move or unassign them first."),
          { code: "LOCATION_HAS_TASKS" },
        );
      }
      await txAny.location.delete({ where: { id: locationId } });
      await this.createActivity(tx, {
        factoryId,
        projectId: loc.projectId,
        actorUserId,
        type: "LOCATION_ADDED",
        message: `حُذف الموقع: ${loc.name}`,
      });
      return { id: locationId };
    });
  }

  async reorderLocations(
    factoryId: string,
    projectId: string,
    orderedIds: string[],
  ) {
    return db.$transaction(async (tx) => {
      const txAny = tx as never as {
        location: {
          findMany: (args: unknown) => Promise<Array<{ id: string }>>;
          update: (args: unknown) => Promise<{ id: string }>;
        };
      };
      const existing = await txAny.location.findMany({
        where: { factoryId, projectId },
      });
      const existingIds = new Set(existing.map((l) => l.id));
      let i = 0;
      for (const id of orderedIds) {
        if (!existingIds.has(id)) continue;
        await txAny.location.update({
          where: { id },
          data: { sortOrder: i },
        });
        i += 1;
      }
    });
  }

  async updateTaskLocation(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    locationId: string | null,
  ) {
    return db.$transaction(async (tx) => {
      const task = await tx.projectTask.findFirst({
        where: { id: taskId, factoryId },
      });
      if (!task) {
        throw new Error("Task not found.");
      }
      let locationName: string | null = null;
      if (locationId) {
        const txAny = tx as never as {
          location: {
            findFirst: (args: unknown) => Promise<{ id: string; name: string; projectId: string } | null>;
          };
        };
        const loc = await txAny.location.findFirst({
          where: { id: locationId, factoryId, projectId: task.projectId },
        });
        if (!loc) {
          throw new Error("Location not found for this project.");
        }
        locationName = loc.name;
      }
      await tx.projectTask.update({
        where: { id: task.id },
        data: { locationId } as never,
      });
      await this.createActivity(tx, {
        factoryId,
        projectId: task.projectId,
        taskId: task.id,
        actorUserId,
        type: "TASK_UPDATED",
        message: locationName
          ? `نُقلت المهمة "${task.title}" إلى موقع: ${locationName}`
          : `أُزيلت المهمة "${task.title}" من موقعها`,
      });
      return tx.projectTask.findUniqueOrThrow({ where: { id: task.id } });
    });
  }

  async getStageInstanceById(
    factoryId: string,
    stageInstanceId: string
  ): Promise<StageInstanceDetail | null> {
    const dbAny = db as never as {
      projectStageInstance: {
        findFirst: (args: unknown) => Promise<Parameters<ProjectRepository["mapStageInstance"]>[0] & {
          projectId: string;
          factoryId: string;
        } | null>;
      };
    };
    const row = await dbAny.projectStageInstance.findFirst({
      where: { id: stageInstanceId, factoryId },
      include: { stage: true, owner: true },
    });
    if (!row) return null;
    return {
      ...this.mapStageInstance(row),
      projectId: row.projectId,
      factoryId: row.factoryId,
    };
  }

  // ============================================================
  // Wave 3 — task ↔ stage assignment + cross-project move.
  // ============================================================

  async updateTaskStage(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    stageInstanceId: string | null,
  ) {
    return db.$transaction(async (tx) => {
      const task = await tx.projectTask.findFirst({
        where: { id: taskId, factoryId },
        include: { project: { select: { code: true } } },
      });
      if (!task) {
        throw new Error("Task not found.");
      }

      let stageName: string | null = null;
      if (stageInstanceId) {
        const txAny = tx as never as {
          projectStageInstance: {
            findFirst: (args: unknown) => Promise<{
              id: string;
              projectId: string;
              stage: { name: string };
            } | null>;
          };
        };
        const inst = await txAny.projectStageInstance.findFirst({
          where: { id: stageInstanceId, factoryId, projectId: task.projectId },
          include: { stage: true },
        });
        if (!inst) {
          throw new Error("Stage instance not found for this project.");
        }
        stageName = inst.stage.name;
      }

      await tx.projectTask.update({
        where: { id: task.id },
        data: { stageInstanceId } as never,
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: task.projectId,
        taskId: task.id,
        stageInstanceId: stageInstanceId,
        actorUserId,
        type: "TASK_UPDATED",
        message: stageName
          ? `نُقلت المهمة "${task.title}" إلى مرحلة: ${stageName}`
          : `أُزيلت المهمة "${task.title}" من مرحلتها`,
      });

      return tx.projectTask.findUniqueOrThrow({ where: { id: task.id } });
    });
  }

  async moveTaskToProject(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    input: MoveTaskToProjectInput,
  ) {
    return db.$transaction(async (tx) => {
      const task = await tx.projectTask.findFirst({
        where: { id: taskId, factoryId },
        include: { project: { select: { id: true, code: true, name: true } } },
      });
      if (!task) {
        throw new Error("Task not found.");
      }
      if (task.projectId === input.targetProjectId) {
        throw new Error("Task is already in the target project.");
      }

      const target = await tx.project.findFirst({
        where: { id: input.targetProjectId, factoryId },
        select: { id: true, code: true, name: true },
      });
      if (!target) {
        throw new Error("Target project not found in this factory.");
      }

      let targetStageName: string | null = null;
      if (input.targetStageInstanceId) {
        const txAny = tx as never as {
          projectStageInstance: {
            findFirst: (args: unknown) => Promise<{
              id: string;
              stage: { name: string };
            } | null>;
          };
        };
        const inst = await txAny.projectStageInstance.findFirst({
          where: {
            id: input.targetStageInstanceId,
            factoryId,
            projectId: target.id,
          },
          include: { stage: true },
        });
        if (!inst) {
          throw new Error("Target stage instance not found.");
        }
        targetStageName = inst.stage.name;
      }

      // Cleanup: remove any work-queue items for this task across all dates,
      // since the daily plan is project-scoped.
      await tx.workQueueItem.deleteMany({ where: { taskId: task.id } });

      const sourceProjectId = task.projectId;
      const sourceCode = task.project.code;

      await tx.projectTask.update({
        where: { id: task.id },
        data: {
          projectId: target.id,
          stageInstanceId: input.targetStageInstanceId ?? null,
        } as never,
      });

      // Activity in BOTH projects.
      await this.createActivity(tx, {
        factoryId,
        projectId: sourceProjectId,
        taskId: task.id,
        actorUserId,
        type: "TASK_UPDATED",
        message: `نُقلت المهمة "${task.title}" إلى المشروع ${target.code}`,
      });
      await this.createActivity(tx, {
        factoryId,
        projectId: target.id,
        taskId: task.id,
        stageInstanceId: input.targetStageInstanceId ?? null,
        actorUserId,
        type: "TASK_UPDATED",
        message: targetStageName
          ? `استُقبلت مهمة "${task.title}" من ${sourceCode} في مرحلة ${targetStageName}`
          : `استُقبلت مهمة "${task.title}" من ${sourceCode}`,
      });

      await this.refreshProjectStatus(tx, sourceProjectId);
      await this.refreshProjectStatus(tx, target.id);

      return tx.projectTask.findUniqueOrThrow({ where: { id: task.id } });
    });
  }

}
