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
  createProjectSchema,
  createProjectTaskSchema,
  moveQueueItemSchema,
  opsDateSchema,
  reorderQueueSchema,
  rescheduleQueueItemSchema,
  reviewProjectTaskSchema,
  updateQueueItemSchema,
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
}
