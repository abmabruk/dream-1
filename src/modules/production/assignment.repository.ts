import "server-only";

import { db } from "@/lib/db";
import type { PrismaTransaction } from "@/lib/db";
import { OrderRepository } from "@/modules/orders/order.repository";

import type {
  CreateAssignmentInput,
  UpdateAssignmentStatusInput,
  WorkerAssignmentItem,
} from "./assignment.schemas";

export class AssignmentRepository {
  private readonly orderRepository = new OrderRepository();

  async listForWorker(factoryId: string, workerId: string): Promise<WorkerAssignmentItem[]> {
    const assignments = await db.assignment.findMany({
      where: {
        factoryId,
        workerId,
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { scheduledFor: "asc" }, { createdAt: "desc" }],
      take: 20,
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      station: assignment.station,
      status: assignment.status,
      scheduledFor: assignment.scheduledFor?.toISOString() ?? null,
      notes: assignment.notes,
      createdAt: assignment.createdAt.toISOString(),
      order: {
        id: assignment.order.id,
        code: assignment.order.code,
        title: assignment.order.title,
        status: assignment.order.status,
        customerName: assignment.order.customer.name,
      },
    }));
  }

  async create(
    factoryId: string,
    actorId: string,
    input: CreateAssignmentInput,
    workerName: string
  ) {
    return db.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          factoryId,
          orderId: input.orderId,
          workerId: input.workerId,
          station: input.station,
          scheduledFor: input.scheduledFor
            ? new Date(input.scheduledFor)
            : undefined,
          notes: input.notes || null,
        },
      });

      await this.orderRepository.createEvent(tx as PrismaTransaction, {
        factoryId,
        orderId: input.orderId,
        actorId,
        type: "ASSIGNMENT_CREATED",
        note: `Assigned ${workerName} to ${input.station}`,
      });

      return assignment;
    });
  }

  async updateStatus(
    factoryId: string,
    actorId: string,
    input: UpdateAssignmentStatusInput,
    workerName: string
  ) {
    return db.$transaction(async (tx) => {
      const existing = await tx.assignment.findFirst({
        where: {
          id: input.assignmentId,
          factoryId,
        },
      });

      if (!existing) {
        return null;
      }

      const assignment = await tx.assignment.update({
        where: {
          id: existing.id,
        },
        data: {
          status: input.status,
          startedAt:
            input.status === "IN_PROGRESS" && !existing.startedAt
              ? new Date()
              : existing.startedAt,
          completedAt: input.status === "DONE" ? new Date() : null,
          notes: input.note || existing.notes,
        },
      });

      await this.orderRepository.createEvent(tx as PrismaTransaction, {
        factoryId,
        orderId: assignment.orderId,
        actorId,
        type: "ASSIGNMENT_STATUS_CHANGED",
        note: `${workerName}: ${existing.status} -> ${input.status}${input.note ? ` | ${input.note}` : ""}`,
      });

      return assignment;
    });
  }
}
