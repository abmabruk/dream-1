import "server-only";

import { db } from "@/lib/db";
import type { OrderWorkflowStatus } from "@/modules/orders/order-status";
import type { AssignmentWorkflowStatus } from "@/modules/production/assignment-status";

export type PortalOrderDetail = {
  factory: {
    name: string;
    currency: string;
    portalDisplayName: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
  };
  access: {
    id: string;
    createdAt: string;
    lastViewedAt: string | null;
  };
  order: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    status: OrderWorkflowStatus;
    targetDate: string | null;
    quotedAmount: number | null;
    approvedAt: string | null;
    customerApprovedAt: string | null;
    customerApprovalNote: string | null;
    deliveredAt: string | null;
    customer: {
      name: string;
      phone: string | null;
      email: string | null;
    };
    assignments: Array<{
      id: string;
      station: string;
      status: AssignmentWorkflowStatus;
      scheduledFor: string | null;
    }>;
    events: Array<{
      id: string;
      type: string;
      fromStatus: OrderWorkflowStatus | null;
      toStatus: OrderWorkflowStatus | null;
      note: string | null;
      createdAt: string;
    }>;
  };
};

export class PortalRepository {
  async getStaffAccess(factoryId: string, orderId: string) {
    return db.orderPortalAccess.findFirst({
      where: {
        factoryId,
        orderId,
      },
    });
  }

  async upsertAccess(factoryId: string, orderId: string, sharedById: string) {
    return db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          factoryId,
        },
      });

      if (!order) {
        return null;
      }

      const access = await tx.orderPortalAccess.upsert({
        where: {
          orderId,
        },
        update: {
          sharedById,
        },
        create: {
          factoryId,
          orderId,
          sharedById,
        },
      });

      await tx.orderEvent.create({
        data: {
          factoryId,
          orderId,
          actorId: sharedById,
          type: "PORTAL_SHARED",
          note: "Portal link generated",
        },
      });

      return access;
    });
  }

  async getByAccess(accessId: string, orderId: string): Promise<PortalOrderDetail | null> {
    const access = await db.orderPortalAccess.findFirst({
      where: {
        id: accessId,
        orderId,
      },
      include: {
        factory: true,
        order: {
          include: {
            customer: true,
            assignments: {
              orderBy: {
                createdAt: "desc",
              },
            },
            events: {
              orderBy: {
                createdAt: "desc",
              },
              take: 30,
            },
          },
        },
      },
    });

    if (!access) {
      return null;
    }

    return {
      factory: {
        name: access.factory.name,
        currency: access.factory.currency,
        portalDisplayName: access.factory.portalDisplayName,
        supportEmail: access.factory.supportEmail,
        supportPhone: access.factory.supportPhone,
      },
      access: {
        id: access.id,
        createdAt: access.createdAt.toISOString(),
        lastViewedAt: access.lastViewedAt?.toISOString() ?? null,
      },
      order: {
        id: access.order.id,
        code: access.order.code,
        title: access.order.title,
        description: access.order.description,
        status: access.order.status,
        targetDate: access.order.targetDate?.toISOString() ?? null,
        quotedAmount: access.order.quotedAmount
          ? Number(access.order.quotedAmount)
          : null,
        approvedAt: access.order.approvedAt?.toISOString() ?? null,
        customerApprovedAt: access.order.customerApprovedAt?.toISOString() ?? null,
        customerApprovalNote: access.order.customerApprovalNote,
        deliveredAt: access.order.deliveredAt?.toISOString() ?? null,
        customer: {
          name: access.order.customer.name,
          phone: access.order.customer.phone,
          email: access.order.customer.email,
        },
        assignments: access.order.assignments.map((assignment) => ({
          id: assignment.id,
          station: assignment.station,
          status: assignment.status,
          scheduledFor: assignment.scheduledFor?.toISOString() ?? null,
        })),
        events: access.order.events.map((event) => ({
          id: event.id,
          type: event.type,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          note: event.note,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    };
  }

  async markViewed(accessId: string) {
    return db.orderPortalAccess.update({
      where: {
        id: accessId,
      },
      data: {
        lastViewedAt: new Date(),
      },
    });
  }

  async approve(accessId: string, orderId: string, note?: string) {
    return db.$transaction(async (tx) => {
      const access = await tx.orderPortalAccess.findFirst({
        where: {
          id: accessId,
          orderId,
        },
        include: {
          order: true,
        },
      });

      if (!access) {
        return null;
      }

      const updatedOrder = await tx.order.update({
        where: {
          id: access.orderId,
        },
        data: {
          status: "APPROVED",
          approvedAt: access.order.approvedAt ?? new Date(),
          customerApprovedAt: new Date(),
          customerApprovalNote: note || null,
        },
      });

      await tx.orderEvent.create({
        data: {
          factoryId: access.factoryId,
          orderId: access.orderId,
          type: "PORTAL_APPROVED",
          fromStatus: access.order.status,
          toStatus: "APPROVED",
          note: note || "Customer approved through portal",
        },
      });

      return updatedOrder;
    });
  }
}
