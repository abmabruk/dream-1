import "server-only";

import { UserStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { OrderRepository } from "@/modules/orders/order.repository";
import {
  createAssignmentSchema,
  updateAssignmentStatusSchema,
  type CreateAssignmentInput,
  type UpdateAssignmentStatusInput,
} from "./assignment.schemas";
import { AssignmentRepository } from "./assignment.repository";
import { ASSIGNMENT_STATUS_TRANSITIONS } from "./assignment-status";

export class AssignmentService {
  constructor(
    private readonly repository = new AssignmentRepository(),
    private readonly orderRepository = new OrderRepository()
  ) {}

  async create(
    factoryId: string,
    actorId: string,
    input: CreateAssignmentInput
  ) {
    const parsed = createAssignmentSchema.parse(input);

    const [order, worker] = await Promise.all([
      this.orderRepository.findWorkflowState(factoryId, parsed.orderId),
      db.user.findFirst({
        where: {
          id: parsed.workerId,
          factoryId,
          status: UserStatus.ACTIVE,
          role: {
            in: ["SUPERVISOR", "WORKER"],
          },
        },
      }),
    ]);

    if (!order) {
      throw new Error("Order not found in this factory.");
    }

    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      throw new Error("Cannot create assignments for closed orders.");
    }

    if (!worker) {
      throw new Error("Selected worker is not assignable in this factory.");
    }

    return this.repository.create(
      factoryId,
      actorId,
      parsed,
      `${worker.firstName} ${worker.lastName}`.trim()
    );
  }

  async listForWorker(factoryId: string, workerId: string) {
    return this.repository.listForWorker(factoryId, workerId);
  }

  async updateStatus(
    factoryId: string,
    actorId: string,
    workerId: string,
    input: UpdateAssignmentStatusInput
  ) {
    const parsed = updateAssignmentStatusSchema.parse(input);
    const existing = await db.assignment.findFirst({
      where: {
        id: parsed.assignmentId,
        factoryId,
        workerId,
      },
      include: {
        worker: true,
      },
    });

    if (!existing) {
      throw new Error("Assignment not found for this worker.");
    }

    if (existing.status === parsed.status) {
      return existing;
    }

    const allowed = ASSIGNMENT_STATUS_TRANSITIONS[existing.status];

    if (!allowed.includes(parsed.status)) {
      throw new Error(`Cannot move assignment from ${existing.status} to ${parsed.status}.`);
    }

    return this.repository.updateStatus(
      factoryId,
      actorId,
      parsed,
      `${existing.worker.firstName} ${existing.worker.lastName}`.trim()
    );
  }
}
