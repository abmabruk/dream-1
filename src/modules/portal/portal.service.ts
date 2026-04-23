import "server-only";

import { env } from "@/lib/env";

import { PortalRepository } from "./portal.repository";
import { signPortalToken, verifyPortalToken } from "./portal-token";

export class PortalService {
  constructor(private readonly repository = new PortalRepository()) {}

  private async buildPortalUrl(orderId: string, accessId: string) {
    const token = await signPortalToken({ orderId, accessId });
    return `${env.APP_URL}/portal/${token}`;
  }

  async getStaffPortalAccess(factoryId: string, orderId: string) {
    const access = await this.repository.getStaffAccess(factoryId, orderId);

    if (!access) {
      return null;
    }

    return {
      id: access.id,
      createdAt: access.createdAt.toISOString(),
      lastViewedAt: access.lastViewedAt?.toISOString() ?? null,
      url: await this.buildPortalUrl(orderId, access.id),
    };
  }

  async createStaffPortalAccess(factoryId: string, orderId: string, sharedById: string) {
    const access = await this.repository.upsertAccess(factoryId, orderId, sharedById);

    if (!access) {
      throw new Error("Order not found in this factory.");
    }

    return {
      id: access.id,
      createdAt: access.createdAt.toISOString(),
      lastViewedAt: access.lastViewedAt?.toISOString() ?? null,
      url: await this.buildPortalUrl(orderId, access.id),
    };
  }

  async getPortalOrder(token: string) {
    const payload = await verifyPortalToken(token);
    const detail = await this.repository.getByAccess(payload.accessId, payload.orderId);

    if (!detail) {
      return null;
    }

    await this.repository.markViewed(detail.access.id);

    return {
      ...detail,
      order: {
        ...detail.order,
        events: detail.order.events.filter((event) =>
          [
            "CREATED",
            "STATUS_CHANGED",
            "ASSIGNMENT_STATUS_CHANGED",
            "PORTAL_SHARED",
            "PORTAL_APPROVED",
          ].includes(event.type)
        ),
      },
    };
  }

  async approveOrder(token: string, note?: string) {
    const payload = await verifyPortalToken(token);
    const current = await this.repository.getByAccess(payload.accessId, payload.orderId);

    if (!current) {
      throw new Error("Portal access is no longer valid.");
    }

    if (current.order.status !== "QUOTED") {
      throw new Error("Only quoted orders can be approved from the portal.");
    }

    await this.repository.approve(payload.accessId, payload.orderId, note);

    return this.getPortalOrder(token);
  }
}
