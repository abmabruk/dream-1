import "server-only";

import {
  UserRole,
  WorkQueueStatus,
} from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import { OrderRepository } from "@/modules/orders/order.repository";
import { UserRepository } from "@/modules/users/user.repository";
import {
  addTaskToTodaySchema,
  advanceStageInputSchema,
  attestDepositInputSchema,
  cloneLocationInputSchema,
  createLocationInputSchema,
  createProjectSchema,
  createProjectTaskSchema,
  moveQueueItemSchema,
  moveTaskToProjectSchema,
  opsDateSchema,
  reorderQueueSchema,
  rescheduleQueueItemSchema,
  reviewProjectTaskSchema,
  reorderLocationsSchema,
  updateLocationInputSchema,
  updateLocationOnTaskSchema,
  updateQueueItemSchema,
  updateTaskStageSchema,
  updateTaskStatusSchema,
} from "./project.schemas";
import { ProjectRepository } from "./project.repository";

function todayBoardDate() {
  return new Date().toISOString().slice(0, 10);
}

export class ProjectService {
  constructor(
    private readonly repository = new ProjectRepository(),
    private readonly orderRepository = new OrderRepository(),
    private readonly userRepository = new UserRepository()
  ) {}

  async list(factoryId: string, workDate = todayBoardDate()) {
    return this.repository.listByFactory(factoryId, workDate);
  }

  async listDetailed(factoryId: string, workDate = todayBoardDate()) {
    return this.repository.listDetailedByFactory(factoryId, workDate);
  }

  async getById(factoryId: string, projectId: string, workDate = todayBoardDate()) {
    const project = await this.repository.getById(factoryId, projectId, workDate);

    if (!project) {
      throw new HttpError(404, "Project not found.");
    }

    return project;
  }

  async getOpsBoard(factoryId: string, input?: { date?: string }) {
    const parsed = opsDateSchema.parse(input ?? {});
    const workDate = parsed.date ?? todayBoardDate();

    return this.repository.getOpsBoard(factoryId, workDate);
  }

  async create(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = createProjectSchema.parse(input);

    if (parsed.orderId) {
      const order = await this.orderRepository.getById(factoryId, parsed.orderId);

      if (!order) {
        throw new HttpError(404, "Order not found for this factory.");
      }
    }

    if (parsed.ownerUserId) {
      const owner = await this.userRepository.findById(factoryId, parsed.ownerUserId);

      if (!owner) {
        throw new HttpError(404, "Project owner not found.");
      }
    }

    return this.repository.createProject(factoryId, actorUserId, parsed);
  }

  async createTask(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = createProjectTaskSchema.parse(input);

    if (parsed.assignedToUserId) {
      const assignee = await this.userRepository.findById(factoryId, parsed.assignedToUserId);

      if (!assignee) {
        throw new HttpError(404, "Task assignee not found.");
      }
    }

    return this.repository.createTask(factoryId, actorUserId, parsed);
  }

  async addTaskToToday(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = addTaskToTodaySchema.parse(input);

    if (parsed.assignedToUserId) {
      const assignee = await this.userRepository.findById(factoryId, parsed.assignedToUserId);

      if (!assignee) {
        throw new HttpError(404, "Queue assignee not found.");
      }
    }

    return this.repository.addTaskToToday(factoryId, actorUserId, parsed);
  }

  async moveQueueItem(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = moveQueueItemSchema.parse(input);

    return this.repository.moveQueueItem(
      factoryId,
      actorUserId,
      parsed.queueItemId,
      parsed.direction
    );
  }

  async reorderQueue(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = reorderQueueSchema.parse(input);

    return this.repository.reorderQueue(factoryId, actorUserId, parsed);
  }

  async rescheduleQueueItem(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = rescheduleQueueItemSchema.parse(input);

    return this.repository.rescheduleQueueItem(factoryId, actorUserId, parsed);
  }

  async updateQueueItem(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = updateQueueItemSchema.parse(input);

    if (parsed.status === WorkQueueStatus.WAITING_APPROVAL) {
      return this.repository.updateQueueItem(factoryId, actorUserId, parsed);
    }

    if (parsed.status === WorkQueueStatus.DONE) {
      const board = await this.repository.getOpsBoard(factoryId, todayBoardDate());
      const queueItem = board.queue.find((item) => item.id === parsed.queueItemId);

      if (!queueItem) {
        throw new HttpError(404, "Queue item not found.");
      }

      if (queueItem.task.requiresApproval) {
        throw new HttpError(
          409,
          "This task requires approval before it can be marked done."
        );
      }
    }

    return this.repository.updateQueueItem(factoryId, actorUserId, parsed);
  }


  async updateTaskStatus(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    status: unknown
  ) {
    const parsed = updateTaskStatusSchema.parse({ status });

    return this.repository.updateTaskStatusByFactory(
      factoryId,
      actorUserId,
      taskId,
      parsed.status
    );
  }

  async reviewTask(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    input: unknown
  ) {
    const parsed = reviewProjectTaskSchema.parse(input);

    if (!["OWNER", "FACTORY_MANAGER", "SUPERVISOR"].includes(actor.role)) {
      throw new HttpError(403, "Your role cannot approve project tasks.");
    }

    return this.repository.reviewTask(factoryId, actor.userId, parsed);
  }

  /**
   * Reorder projects within a factory. Accepts a list of project IDs
   * in display order (top → bottom). Requires `projects:manage`.
   */
  async reorderProjects(factoryId: string, orderedIds: unknown): Promise<void> {
    if (!Array.isArray(orderedIds)) {
      throw new HttpError(400, "orderedIds must be an array of project IDs.");
    }
    const ids = orderedIds.filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (ids.length === 0) {
      throw new HttpError(400, "orderedIds is empty.");
    }
    await this.repository.reorderProjectsByFactory(factoryId, ids);
  }


  // ============================================================
  // Stages
  // ============================================================

  async getStageInstances(factoryId: string, projectId: string) {
    return this.repository.listStageInstancesForProject(factoryId, projectId);
  }

  async advanceStage(
    factoryId: string,
    projectId: string,
    actorUserId: string,
    input: unknown
  ) {
    const parsed = advanceStageInputSchema.parse(input);
    try {
      return await this.repository.advanceStage(
        factoryId,
        projectId,
        parsed.stageInstanceId,
        actorUserId
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "DEPOSIT_REQUIRED") {
        throw new HttpError(
          409,
          "DEPOSIT_REQUIRED: لا يمكن التقدم قبل تأكيد استلام العربون.",
          { code: "DEPOSIT_REQUIRED" }
        );
      }
      throw err;
    }
  }

  async startStage(factoryId: string, stageInstanceId: string, actorUserId: string) {
    return this.repository.startStage(factoryId, stageInstanceId, actorUserId);
  }

  async backfillProjectStages(
    factoryId: string,
    projectId: string,
    actorUserId: string
  ) {
    return this.repository.backfillProjectStages(factoryId, projectId, actorUserId);
  }

  async attestDeposit(
    factoryId: string,
    actorUserId: string,
    input: unknown
  ) {
    const parsed = attestDepositInputSchema.parse(input);
    return this.repository.attestDeposit(
      factoryId,
      parsed.stageInstanceId,
      actorUserId,
      parsed
    );
  }

  // ============================================================
  // Locations
  // ============================================================

  async listLocations(factoryId: string, projectId: string) {
    return this.repository.listLocations(factoryId, projectId);
  }

  async createLocation(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = createLocationInputSchema.parse(input);
    return this.repository.createLocation(factoryId, actorUserId, parsed);
  }

  async cloneLocation(
    factoryId: string,
    actorUserId: string,
    sourceLocationId: string,
    targetProjectId: string,
    rawOptions?: unknown,
  ) {
    const options = cloneLocationInputSchema.parse(rawOptions ?? {});
    return this.repository.cloneLocation(
      factoryId,
      actorUserId,
      sourceLocationId,
      targetProjectId,
      options,
    );
  }

  async deleteLocation(
    factoryId: string,
    actorUserId: string,
    locationId: string,
  ) {
    try {
      return await this.repository.deleteLocation(
        factoryId,
        actorUserId,
        locationId,
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "LOCATION_HAS_TASKS") {
        throw new HttpError(
          409,
          "لا يمكن حذف الموقع لأنه يحتوي على مهام. انقل المهام أولاً.",
          { code: "LOCATION_HAS_TASKS" },
        );
      }
      if (code === "NOT_FOUND") {
        throw new HttpError(404, "الموقع غير موجود.");
      }
      throw err;
    }
  }

  async reorderLocations(
    factoryId: string,
    projectId: string,
    rawInput: unknown,
  ) {
    const parsed = reorderLocationsSchema.parse(rawInput);
    return this.repository.reorderLocations(
      factoryId,
      projectId,
      parsed.orderedIds,
    );
  }

  async updateTaskLocation(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    rawInput: unknown,
  ) {
    const parsed = updateLocationOnTaskSchema.parse(rawInput);
    return this.repository.updateTaskLocation(
      factoryId,
      actorUserId,
      taskId,
      parsed.locationId,
    );
  }

  async updateLocation(factoryId: string, actorUserId: string, input: unknown) {
    const parsed = updateLocationInputSchema.parse(input);
    return this.repository.updateLocation(factoryId, actorUserId, parsed);
  }

  // ============================================================
  // Wave 3 — task ↔ stage assignment + cross-project move.
  // ============================================================

  async updateTaskStage(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    input: unknown,
  ) {
    const parsed = updateTaskStageSchema.parse(input);
    return this.repository.updateTaskStage(
      factoryId,
      actorUserId,
      taskId,
      parsed.stageInstanceId,
    );
  }

  async moveTaskToProject(
    factoryId: string,
    actorUserId: string,
    taskId: string,
    input: unknown,
  ) {
    const parsed = moveTaskToProjectSchema.parse(input);
    return this.repository.moveTaskToProject(
      factoryId,
      actorUserId,
      taskId,
      parsed,
    );
  }

}
