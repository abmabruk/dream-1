import "server-only";

import { UserStatus } from "@prisma/client";

import { db } from "@/lib/db";

import type { FactorySettingsSnapshot, UpdateFactorySettingsInput } from "./settings.schemas";

function toSnapshot(input: {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  orderCodePrefix: string;
  portalDisplayName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  totalOrders: number;
  activeUsers: number;
}): FactorySettingsSnapshot {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    timezone: input.timezone,
    currency: input.currency,
    orderCodePrefix: input.orderCodePrefix,
    portalDisplayName: input.portalDisplayName,
    supportEmail: input.supportEmail,
    supportPhone: input.supportPhone,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    stats: {
      totalOrders: input.totalOrders,
      activeUsers: input.activeUsers,
    },
    previews: {
      nextOrderCode: `${input.orderCodePrefix}-${String(input.totalOrders + 1).padStart(5, "0")}`,
      portalDisplayNameResolved: input.portalDisplayName || input.name,
    },
  };
}

export class SettingsRepository {
  async getByFactory(factoryId: string): Promise<FactorySettingsSnapshot | null> {
    const [factory, totalOrders, activeUsers] = await Promise.all([
      db.factory.findUnique({
        where: { id: factoryId },
      }),
      db.order.count({
        where: { factoryId },
      }),
      db.user.count({
        where: {
          factoryId,
          status: UserStatus.ACTIVE,
        },
      }),
    ]);

    if (!factory) {
      return null;
    }

    return toSnapshot({
      ...factory,
      totalOrders,
      activeUsers,
    });
  }

  async update(factoryId: string, input: UpdateFactorySettingsInput) {
    await db.factory.update({
      where: { id: factoryId },
      data: {
        name: input.name,
        timezone: input.timezone,
        currency: input.currency,
        orderCodePrefix: input.orderCodePrefix,
        portalDisplayName: input.portalDisplayName || null,
        supportEmail: input.supportEmail || null,
        supportPhone: input.supportPhone || null,
      },
    });

    return this.getByFactory(factoryId);
  }
}
