import "server-only";

import {
  ProjectStatus,
  ProjectTaskStatus,
  TaskApprovalStatus,
  WorkQueueStatus,
} from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import type {
  AddTaskToTodayInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  OpsBoardData,
  ProjectDetail,
  ProjectListItem,
  ReorderQueueInput,
  RescheduleQueueItemInput,
  ReviewProjectTaskInput,
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
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
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
    }));
  }

  async listDetailedByFactory(factoryId: string, workDate: string): Promise<ProjectDetail[]> {
    const start = toBoardDate(workDate);
    const end = addDays(start, 1);

    const projects = await db.project.findMany({
      where: {
        factoryId,
        status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
      },
      include: {
        owner: true,
        order: { select: { code: true } },
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
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
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
      tasks: project.tasks.map((task) => ({
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
        todayQueueItem: task.queueItems[0]
          ? {
              id: task.queueItems[0].id,
              status: task.queueItems[0].status,
              position: task.queueItems[0].position,
              assignedToName: displayName(task.queueItems[0].assignedTo),
              notes: task.queueItems[0].notes,
            }
          : null,
      })),
      activities: project.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        message: activity.message,
        actorName: displayName(activity.actor),
        createdAt: activity.createdAt.toISOString(),
      })),
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
            code: true,
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
      tasks: project.tasks.map((task) => ({
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
        todayQueueItem: task.queueItems[0]
          ? {
              id: task.queueItems[0].id,
              status: task.queueItems[0].status,
              position: task.queueItems[0].position,
              assignedToName: displayName(task.queueItems[0].assignedTo),
              notes: task.queueItems[0].notes,
            }
          : null,
      })),
      activities: project.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        message: activity.message,
        actorName: displayName(activity.actor),
        createdAt: activity.createdAt.toISOString(),
      })),
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
        message: `Project ${project.code} created.`,
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
        },
      });

      await this.createActivity(tx, {
        factoryId,
        projectId: input.projectId,
        taskId: task.id,
        actorUserId,
        type: "TASK_CREATED",
        message: `Task "${task.title}" added to project ${project.code}.`,
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
        message: `Task "${task.title}" added to the daily queue.`,
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
        message: `Daily queue reordered for ${input.workDate}.`,
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
        message: `Task "${queueItem.task.title}" moved to ${input.targetDate}.`,
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
        message: `Task "${queueItem.task.title}" was moved ${direction} in the daily queue.`,
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
        message: `Task "${queueItem.task.title}" moved to ${input.status.toLowerCase().replaceAll("_", " ")}.`,
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
        | "TASK_REJECTED";
      message: string;
    }
  ) {
    return tx.projectActivity.create({
      data: {
        factoryId: input.factoryId,
        projectId: input.projectId,
        taskId: input.taskId,
        actorUserId: input.actorUserId ?? null,
        type: input.type,
        message: input.message,
      },
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
}
