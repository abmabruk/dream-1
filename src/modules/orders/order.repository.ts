import "server-only";

import { db, type PrismaTransaction } from "@/lib/db";
import type {
  CreateOrderInput,
  OrderDetail,
  OrderListItem,
  UpdateOrderStatusInput,
} from "./order.schemas";

export class OrderRepository {
  async listByFactory(factoryId: string): Promise<OrderListItem[]> {
    const orders = await db.order.findMany({
      where: { factoryId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return orders.map((order) => ({
      id: order.id,
      code: order.code,
      title: order.title,
      status: order.status,
      customerName: order.customer.name,
      targetDate: order.targetDate?.toISOString() ?? null,
      quotedAmount: order.quotedAmount ? Number(order.quotedAmount) : null,
    }));
  }

  async create(factoryId: string, createdById: string, input: CreateOrderInput) {
    const factory = await db.factory.findUnique({
      where: { id: factoryId },
      select: {
        orderCodePrefix: true,
      },
    });

    if (!factory) {
      throw new Error("Factory not found.");
    }

    const count = await db.order.count({ where: { factoryId } });
    const code = `${factory.orderCodePrefix}-${String(count + 1).padStart(5, "0")}`;

    return db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          factoryId,
          createdById,
          customerId: input.customerId,
          title: input.title,
          description: input.description || null,
          code,
          quotedAmount: input.quotedAmount ?? null,
          targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        },
      });

      await tx.orderEvent.create({
        data: {
          factoryId,
          orderId: order.id,
          actorId: createdById,
          type: "CREATED",
          toStatus: order.status,
          note: "Order created",
        },
      });

      return order;
    });
  }

  async getById(factoryId: string, orderId: string): Promise<OrderDetail | null> {
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        factoryId,
      },
      include: {
        customer: true,
        owner: true,
        createdBy: true,
        portalAccess: true,
        assignments: {
          include: {
            worker: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        events: {
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

    if (!order) {
      return null;
    }

    return {
      id: order.id,
      code: order.code,
      title: order.title,
      description: order.description,
      status: order.status,
      customer: {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        city: order.customer.city,
        district: order.customer.district,
      },
      ownerName: order.owner
        ? `${order.owner.firstName} ${order.owner.lastName}`.trim()
        : null,
      createdByName: order.createdBy
        ? `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim()
        : null,
      targetDate: order.targetDate?.toISOString() ?? null,
      quotedAmount: order.quotedAmount ? Number(order.quotedAmount) : null,
      approvedAt: order.approvedAt?.toISOString() ?? null,
      customerApprovedAt: order.customerApprovedAt?.toISOString() ?? null,
      customerApprovalNote: order.customerApprovalNote,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      portalAccess: order.portalAccess
        ? {
            id: order.portalAccess.id,
            createdAt: order.portalAccess.createdAt.toISOString(),
            lastViewedAt: order.portalAccess.lastViewedAt?.toISOString() ?? null,
          }
        : null,
      assignments: order.assignments.map((assignment) => ({
        id: assignment.id,
        station: assignment.station,
        status: assignment.status,
        workerId: assignment.workerId,
        workerName: `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim(),
        workerRole: assignment.worker.role,
        scheduledFor: assignment.scheduledFor?.toISOString() ?? null,
        notes: assignment.notes,
        createdAt: assignment.createdAt.toISOString(),
      })),
      events: order.events.map((event) => ({
        id: event.id,
        type: event.type,
        actorName: event.actor
          ? `${event.actor.firstName} ${event.actor.lastName}`.trim()
          : null,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async findWorkflowState(factoryId: string, orderId: string) {
    return db.order.findFirst({
      where: {
        id: orderId,
        factoryId,
      },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        deliveredAt: true,
      },
    });
  }

  async updateStatus(
    factoryId: string,
    actorId: string,
    input: UpdateOrderStatusInput
  ) {
    return db.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: {
          id: input.orderId,
          factoryId,
        },
      });

      if (!existing) {
        return null;
      }

      const updated = await tx.order.update({
        where: {
          id: existing.id,
        },
        data: {
          status: input.status,
          approvedAt:
            input.status === "APPROVED" && !existing.approvedAt
              ? new Date()
              : existing.approvedAt,
          deliveredAt:
            input.status === "DELIVERED" ? new Date() : null,
        },
      });

      await tx.orderEvent.create({
        data: {
          factoryId,
          orderId: existing.id,
          actorId,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: input.status,
          note: input.note || null,
        },
      });

      return updated;
    });
  }

  createEvent(
    tx: PrismaTransaction,
    input: {
      factoryId: string;
      orderId: string;
      actorId: string;
      type: "ASSIGNMENT_CREATED" | "ASSIGNMENT_STATUS_CHANGED";
      note?: string | null;
    }
  ) {
    return tx.orderEvent.create({
      data: {
        factoryId: input.factoryId,
        orderId: input.orderId,
        actorId: input.actorId,
        type: input.type,
        note: input.note ?? null,
      },
    });
  }
}
