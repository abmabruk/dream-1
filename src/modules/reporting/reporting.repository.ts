import "server-only";

import { AssignmentStatus, InquiryStage, OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import {
  INQUIRY_STAGE_VALUES,
  OPEN_INQUIRY_STAGE_VALUES,
} from "@/modules/crm/inquiry-stage";
import {
  INCOMPLETE_ORDER_STATUS_VALUES,
  ORDER_STATUS_VALUES,
} from "@/modules/orders/order-status";

import type { ReportingQuery } from "./reporting.schemas";

const OPEN_INQUIRY_STAGES: InquiryStage[] = [...OPEN_INQUIRY_STAGE_VALUES];
const INCOMPLETE_ORDER_STATUSES: OrderStatus[] = [
  ...INCOMPLETE_ORDER_STATUS_VALUES,
];
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isWithinRange(date: Date | null | undefined, query: ReportingQuery) {
  return Boolean(date && date >= query.startAt && date <= query.endAt);
}

function differenceInDays(from: Date, to: Date) {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / ONE_DAY_IN_MS));
}

export type ReportingSnapshot = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  filters: {
    orderStatuses: OrderStatus[];
    inquiryStages: InquiryStage[];
  };
  summary: {
    ordersCreated: number;
    ordersApproved: number;
    ordersDelivered: number;
    newCustomers: number;
    newInquiries: number;
    quotedRevenue: number;
    deliveredRevenue: number;
    completedAssignments: number;
    overdueOrders: number;
    dueFollowUps: number;
  };
  currentPipeline: {
    orderStatuses: Array<{
      status: OrderStatus;
      count: number;
    }>;
    inquiryStages: Array<{
      stage: InquiryStage;
      count: number;
    }>;
  };
  activitySeries: Array<{
    date: string;
    ordersCreated: number;
    ordersDelivered: number;
    customersAdded: number;
    inquiriesCreated: number;
  }>;
  monthlySeries: Array<{
    month: string;
    ordersCreated: number;
    ordersDelivered: number;
    customersAdded: number;
    inquiriesCreated: number;
    quotedRevenue: number;
    deliveredRevenue: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
    quotedRevenue: number;
    deliveredRevenue: number;
  }>;
  workerOutput: Array<{
    workerId: string;
    workerName: string;
    completedAssignments: number;
    inProgressAssignments: number;
    plannedAssignments: number;
  }>;
  overdueOrderList: Array<{
    id: string;
    code: string;
    title: string;
    customerName: string;
    status: OrderStatus;
    targetDate: string;
    daysLate: number;
  }>;
  followUpList: Array<{
    id: string;
    name: string;
    phone: string;
    stage: InquiryStage;
    assignedToName: string | null;
    nextFollowUpAt: string;
  }>;
};

export class ReportingRepository {
  async getOverview(
    factoryId: string,
    query: ReportingQuery
  ): Promise<ReportingSnapshot> {
    const now = new Date();
    const selectedOrderStatuses = query.filters.orderStatuses as OrderStatus[];
    const selectedInquiryStages = query.filters.inquiryStages as InquiryStage[];
    const overdueStatuses =
      selectedOrderStatuses.length > 0
        ? INCOMPLETE_ORDER_STATUSES.filter((status) =>
            selectedOrderStatuses.includes(status)
          )
        : INCOMPLETE_ORDER_STATUSES;
    const dueFollowUpStages =
      selectedInquiryStages.length > 0
        ? OPEN_INQUIRY_STAGES.filter((stage) => selectedInquiryStages.includes(stage))
        : OPEN_INQUIRY_STAGES;
    const orderStatusWhere =
      selectedOrderStatuses.length > 0
        ? {
            status: {
              in: selectedOrderStatuses,
            },
          }
        : {};
    const inquiryStageWhere =
      selectedInquiryStages.length > 0
        ? {
            stage: {
              in: selectedInquiryStages,
            },
          }
        : {};
    const assignmentOrderWhere =
      selectedOrderStatuses.length > 0
        ? {
            order: {
              status: {
                in: selectedOrderStatuses,
              },
            },
          }
        : {};

    const [
      ordersCreated,
      ordersApproved,
      ordersDelivered,
      newCustomers,
      newInquiries,
      completedAssignments,
      quotedRevenueAggregate,
      deliveredRevenueAggregate,
      overdueOrders,
      dueFollowUps,
      orderStatusCounts,
      inquiryStageCounts,
      activityOrders,
      activityCustomers,
      activityInquiries,
      completedAssignmentsByWorker,
      currentAssignmentsByWorker,
    ] = await Promise.all([
      db.order.count({
        where: {
          factoryId,
          ...orderStatusWhere,
          createdAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
      }),
      db.order.count({
        where: {
          factoryId,
          ...orderStatusWhere,
          approvedAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
      }),
      db.order.count({
        where: {
          factoryId,
          ...orderStatusWhere,
          deliveredAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
      }),
      db.customer.count({
        where: {
          factoryId,
          createdAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
      }),
      db.inquiry.count({
        where: {
          factoryId,
          ...inquiryStageWhere,
          createdAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
      }),
      db.assignment.count({
        where: {
          factoryId,
          ...assignmentOrderWhere,
          completedAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
      }),
      db.order.aggregate({
        where: {
          factoryId,
          ...orderStatusWhere,
          createdAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
        _sum: {
          quotedAmount: true,
        },
      }),
      db.order.aggregate({
        where: {
          factoryId,
          ...orderStatusWhere,
          deliveredAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
        _sum: {
          quotedAmount: true,
        },
      }),
      db.order.findMany({
        where: {
          factoryId,
          status: {
            in: overdueStatuses,
          },
          targetDate: {
            lt: now,
          },
        },
        include: {
          customer: true,
        },
        orderBy: {
          targetDate: "asc",
        },
      }),
      db.inquiry.findMany({
        where: {
          factoryId,
          stage: {
            in: dueFollowUpStages,
          },
          nextFollowUpAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
        include: {
          assignedTo: true,
        },
        orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "asc" }],
      }),
      db.order.groupBy({
        by: ["status"],
        where: {
          factoryId,
          ...orderStatusWhere,
        },
        _count: {
          _all: true,
        },
      }),
      db.inquiry.groupBy({
        by: ["stage"],
        where: {
          factoryId,
          ...inquiryStageWhere,
        },
        _count: {
          _all: true,
        },
      }),
      db.order.findMany({
        where: {
          factoryId,
          ...orderStatusWhere,
          OR: [
            {
              createdAt: {
                gte: query.startAt,
                lte: query.endAt,
              },
            },
            {
              deliveredAt: {
                gte: query.startAt,
                lte: query.endAt,
              },
            },
          ],
        },
        select: {
          id: true,
          createdAt: true,
          deliveredAt: true,
          quotedAmount: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      db.customer.findMany({
        where: {
          factoryId,
          createdAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      db.inquiry.findMany({
        where: {
          factoryId,
          ...inquiryStageWhere,
          createdAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      db.assignment.findMany({
        where: {
          factoryId,
          ...assignmentOrderWhere,
          completedAt: {
            gte: query.startAt,
            lte: query.endAt,
          },
        },
        include: {
          worker: true,
        },
      }),
      db.assignment.findMany({
        where: {
          factoryId,
          ...assignmentOrderWhere,
          status: {
            in: [AssignmentStatus.PLANNED, AssignmentStatus.IN_PROGRESS],
          },
        },
        include: {
          worker: true,
        },
      }),
    ]);

    const activitySeriesMap = new Map<
      string,
      {
        date: string;
        ordersCreated: number;
        ordersDelivered: number;
        customersAdded: number;
        inquiriesCreated: number;
      }
    >();
    const monthlySeriesMap = new Map<
      string,
      {
        month: string;
        ordersCreated: number;
        ordersDelivered: number;
        customersAdded: number;
        inquiriesCreated: number;
        quotedRevenue: number;
        deliveredRevenue: number;
      }
    >();
    const topCustomersByRevenue = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        orderCount: number;
        quotedRevenue: number;
        deliveredRevenue: number;
      }
    >();
    const workerOutputMap = new Map<
      string,
      {
        workerId: string;
        workerName: string;
        completedAssignments: number;
        inProgressAssignments: number;
        plannedAssignments: number;
      }
    >();

    const dayCursor = new Date(query.startAt);
    dayCursor.setUTCHours(0, 0, 0, 0);

    while (dayCursor <= query.endAt) {
      const key = toDateKey(dayCursor);
      activitySeriesMap.set(key, {
        date: key,
        ordersCreated: 0,
        ordersDelivered: 0,
        customersAdded: 0,
        inquiriesCreated: 0,
      });
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }

    const monthCursor = toMonthStart(query.startAt);
    const endMonth = toMonthStart(query.endAt);

    while (monthCursor <= endMonth) {
      const key = toMonthKey(monthCursor);
      monthlySeriesMap.set(key, {
        month: key,
        ordersCreated: 0,
        ordersDelivered: 0,
        customersAdded: 0,
        inquiriesCreated: 0,
        quotedRevenue: 0,
        deliveredRevenue: 0,
      });
      monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }

    for (const order of activityOrders) {
      if (isWithinRange(order.createdAt, query)) {
        const dayKey = toDateKey(order.createdAt);
        const monthKey = toMonthKey(order.createdAt);
        const dayEntry = activitySeriesMap.get(dayKey);
        const monthEntry = monthlySeriesMap.get(monthKey);

        if (dayEntry) {
          dayEntry.ordersCreated += 1;
        }

        if (monthEntry) {
          monthEntry.ordersCreated += 1;
          monthEntry.quotedRevenue += Number(order.quotedAmount ?? 0);
        }
      }

      if (isWithinRange(order.deliveredAt, query)) {
        const deliveredAt = order.deliveredAt as Date;
        const dayKey = toDateKey(deliveredAt);
        const monthKey = toMonthKey(deliveredAt);
        const dayEntry = activitySeriesMap.get(dayKey);
        const monthEntry = monthlySeriesMap.get(monthKey);

        if (dayEntry) {
          dayEntry.ordersDelivered += 1;
        }

        if (monthEntry) {
          monthEntry.ordersDelivered += 1;
          monthEntry.deliveredRevenue += Number(order.quotedAmount ?? 0);
        }
      }

      const customerEntry =
        topCustomersByRevenue.get(order.customer.id) ??
        {
          customerId: order.customer.id,
          customerName: order.customer.name,
          orderCount: 0,
          quotedRevenue: 0,
          deliveredRevenue: 0,
        };

      if (isWithinRange(order.createdAt, query)) {
        customerEntry.orderCount += 1;
        customerEntry.quotedRevenue += Number(order.quotedAmount ?? 0);
      }

      if (isWithinRange(order.deliveredAt, query)) {
        customerEntry.deliveredRevenue += Number(order.quotedAmount ?? 0);
      }

      topCustomersByRevenue.set(order.customer.id, customerEntry);
    }

    for (const customer of activityCustomers) {
      const dayEntry = activitySeriesMap.get(toDateKey(customer.createdAt));
      const monthEntry = monthlySeriesMap.get(toMonthKey(customer.createdAt));

      if (dayEntry) {
        dayEntry.customersAdded += 1;
      }

      if (monthEntry) {
        monthEntry.customersAdded += 1;
      }
    }

    for (const inquiry of activityInquiries) {
      const dayEntry = activitySeriesMap.get(toDateKey(inquiry.createdAt));
      const monthEntry = monthlySeriesMap.get(toMonthKey(inquiry.createdAt));

      if (dayEntry) {
        dayEntry.inquiriesCreated += 1;
      }

      if (monthEntry) {
        monthEntry.inquiriesCreated += 1;
      }
    }

    for (const assignment of currentAssignmentsByWorker) {
      const entry =
        workerOutputMap.get(assignment.workerId) ??
        {
          workerId: assignment.workerId,
          workerName: `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim(),
          completedAssignments: 0,
          inProgressAssignments: 0,
          plannedAssignments: 0,
        };

      if (assignment.status === AssignmentStatus.IN_PROGRESS) {
        entry.inProgressAssignments += 1;
      }

      if (assignment.status === AssignmentStatus.PLANNED) {
        entry.plannedAssignments += 1;
      }

      workerOutputMap.set(assignment.workerId, entry);
    }

    for (const assignment of completedAssignmentsByWorker) {
      const entry =
        workerOutputMap.get(assignment.workerId) ??
        {
          workerId: assignment.workerId,
          workerName: `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim(),
          completedAssignments: 0,
          inProgressAssignments: 0,
          plannedAssignments: 0,
        };

      entry.completedAssignments += 1;
      workerOutputMap.set(assignment.workerId, entry);
    }

    const orderStatusMap = new Map(
      orderStatusCounts.map((entry) => [entry.status, entry._count._all])
    );
    const inquiryStageMap = new Map(
      inquiryStageCounts.map((entry) => [entry.stage, entry._count._all])
    );

    return {
      range: {
        from: query.from,
        to: query.to,
        days: query.days,
      },
      filters: {
        orderStatuses: selectedOrderStatuses,
        inquiryStages: selectedInquiryStages,
      },
      summary: {
        ordersCreated,
        ordersApproved,
        ordersDelivered,
        newCustomers,
        newInquiries,
        quotedRevenue: Number(quotedRevenueAggregate._sum.quotedAmount ?? 0),
        deliveredRevenue: Number(deliveredRevenueAggregate._sum.quotedAmount ?? 0),
        completedAssignments,
        overdueOrders: overdueOrders.length,
        dueFollowUps: dueFollowUps.length,
      },
      currentPipeline: {
        orderStatuses: ORDER_STATUS_VALUES.map((status) => ({
          status,
          count: orderStatusMap.get(status) ?? 0,
        })),
        inquiryStages: INQUIRY_STAGE_VALUES.map((stage) => ({
          stage,
          count: inquiryStageMap.get(stage) ?? 0,
        })),
      },
      activitySeries: Array.from(activitySeriesMap.values()),
      monthlySeries: Array.from(monthlySeriesMap.values()),
      topCustomers: Array.from(topCustomersByRevenue.values())
        .sort((left, right) => {
          if (right.quotedRevenue !== left.quotedRevenue) {
            return right.quotedRevenue - left.quotedRevenue;
          }

          if (right.deliveredRevenue !== left.deliveredRevenue) {
            return right.deliveredRevenue - left.deliveredRevenue;
          }

          return right.orderCount - left.orderCount;
        })
        .slice(0, 5),
      workerOutput: Array.from(workerOutputMap.values())
        .sort((left, right) => {
          if (right.completedAssignments !== left.completedAssignments) {
            return right.completedAssignments - left.completedAssignments;
          }

          if (right.inProgressAssignments !== left.inProgressAssignments) {
            return right.inProgressAssignments - left.inProgressAssignments;
          }

          return right.plannedAssignments - left.plannedAssignments;
        })
        .slice(0, 5),
      overdueOrderList: overdueOrders.slice(0, 5).map((order) => ({
        id: order.id,
        code: order.code,
        title: order.title,
        customerName: order.customer.name,
        status: order.status,
        targetDate: order.targetDate?.toISOString() ?? query.to,
        daysLate: differenceInDays(order.targetDate ?? now, now),
      })),
      followUpList: dueFollowUps.slice(0, 5).map((inquiry) => ({
        id: inquiry.id,
        name: inquiry.name,
        phone: inquiry.phone,
        stage: inquiry.stage,
        assignedToName: inquiry.assignedTo
          ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}`.trim()
          : null,
        nextFollowUpAt: inquiry.nextFollowUpAt?.toISOString() ?? query.to,
      })),
    };
  }
}
