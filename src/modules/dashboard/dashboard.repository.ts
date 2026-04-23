import "server-only";

import { OrderStatus, UserStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { hasValidEnv } from "@/lib/env";

export type DashboardSnapshot = {
  stats: {
    totalCustomers: number;
    totalOrders: number;
    activeOrders: number;
    deliveredOrders: number;
    quotedRevenue: number;
    activeUsers: number;
  };
  setup: {
    envReady: boolean;
    hasCustomers: boolean;
    hasOrders: boolean;
    hasMultipleUsers: boolean;
  };
  recentOrders: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    customerName: string;
    createdAt: string;
  }>;
  recentCustomers: Array<{
    id: string;
    name: string;
    phone: string | null;
    orderCount: number;
    createdAt: string;
  }>;
};

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "QUOTED",
  "APPROVED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
];

export class DashboardRepository {
  async getSnapshot(factoryId: string): Promise<DashboardSnapshot> {
    const [
      totalCustomers,
      totalOrders,
      activeOrders,
      deliveredOrders,
      activeUsers,
      quotedAggregate,
      recentOrders,
      recentCustomers,
    ] = await Promise.all([
      db.customer.count({ where: { factoryId } }),
      db.order.count({ where: { factoryId } }),
      db.order.count({
        where: {
          factoryId,
          status: {
            in: ACTIVE_ORDER_STATUSES,
          },
        },
      }),
      db.order.count({
        where: {
          factoryId,
          status: "DELIVERED",
        },
      }),
      db.user.count({
        where: {
          factoryId,
          status: UserStatus.ACTIVE,
        },
      }),
      db.order.aggregate({
        where: {
          factoryId,
        },
        _sum: {
          quotedAmount: true,
        },
      }),
      db.order.findMany({
        where: { factoryId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.customer.findMany({
        where: { factoryId },
        include: {
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      stats: {
        totalCustomers,
        totalOrders,
        activeOrders,
        deliveredOrders,
        quotedRevenue: Number(quotedAggregate._sum.quotedAmount ?? 0),
        activeUsers,
      },
      setup: {
        envReady: hasValidEnv(),
        hasCustomers: totalCustomers > 0,
        hasOrders: totalOrders > 0,
        hasMultipleUsers: activeUsers > 1,
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        code: order.code,
        title: order.title,
        status: order.status,
        customerName: order.customer.name,
        createdAt: order.createdAt.toISOString(),
      })),
      recentCustomers: recentCustomers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        orderCount: customer._count.orders,
        createdAt: customer.createdAt.toISOString(),
      })),
    };
  }
}
