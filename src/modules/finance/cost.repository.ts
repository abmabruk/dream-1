import "server-only";

import { Prisma } from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import {
  COST_CATEGORY_VALUES,
  type CostCategory,
  type CostInputType,
  type CostListItem,
  type FactoryCostSummary,
  type ProjectCostSummary,
} from "./cost.schemas";

/**
 * Until `prisma generate` runs against the new schema (which adds the
 * `ProjectCost` model and `Cost*` enum types), the auto-generated client
 * surface lacks `db.projectCost`. We declare the shape we need here and
 * typecast at the call site. After running prisma generate this module
 * still works because the property names line up 1:1 with the model.
 */
type ProjectCostRow = {
  id: string;
  factoryId: string;
  projectId: string;
  taskId: string | null;
  category: CostCategory;
  amount: Prisma.Decimal;
  currency: string;
  description: string;
  vendorName: string | null;
  receiptUrl: string | null;
  incurredAt: Date;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  stageInstanceId: string | null;
  locationId: string | null;
  quoteLineId: string | null;
};

type ProjectCostWithCreator = ProjectCostRow & {
  createdBy: { firstName: string; lastName: string } | null;
  stageInstance?: {
    id: string;
    stage: { name: string } | null;
  } | null;
  location?: {
    id: string;
    name: string;
  } | null;
  quoteLine?: {
    id: string;
    description: string;
    unitPrice: Prisma.Decimal;
    quantity: Prisma.Decimal;
    quote: { version: number } | null;
  } | null;
};

interface ProjectCostDelegate {
  create(args: {
    data: Omit<ProjectCostRow, "id" | "createdAt" | "updatedAt">;
    include?: {
      createdBy?: boolean;
      stageInstance?: boolean | { include?: { stage?: boolean } };
      location?: boolean;
      quoteLine?: boolean | { select?: Record<string, unknown> };
    };
  }): Promise<ProjectCostWithCreator>;
  findFirst(args: {
    where: { id?: string; factoryId?: string; projectId?: string };
  }): Promise<ProjectCostRow | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: {
      createdBy?: boolean;
      stageInstance?: boolean | { include?: { stage?: boolean } };
      location?: boolean;
      quoteLine?: boolean | { select?: Record<string, unknown> };
    };
    select?: Record<string, boolean>;
    orderBy?: Record<string, "asc" | "desc"> | { incurredAt?: "asc" | "desc"; createdAt?: "asc" | "desc" }[];
    take?: number;
  }): Promise<ProjectCostWithCreator[]>;
  delete(args: { where: { id: string } }): Promise<ProjectCostRow>;
}

interface DbWithCost {
  projectCost: ProjectCostDelegate;
}

interface TxWithCost {
  projectCost: ProjectCostDelegate;
  project: PrismaTransaction["project"];
  projectTask: PrismaTransaction["projectTask"];
  projectActivity: PrismaTransaction["projectActivity"];
}

function decToString(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return value.toFixed(2);
}

function emptyByCategory(): Record<CostCategory, string> {
  return COST_CATEGORY_VALUES.reduce(
    (acc, c) => {
      acc[c] = "0.00";
      return acc;
    },
    {} as Record<CostCategory, string>,
  );
}

function displayName(user: { firstName: string; lastName: string } | null | undefined) {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim();
}

function mapCost(c: ProjectCostWithCreator): CostListItem {
  return {
    id: c.id,
    projectId: c.projectId,
    taskId: c.taskId,
    category: c.category,
    amount: decToString(c.amount),
    currency: c.currency,
    description: c.description,
    vendorName: c.vendorName,
    receiptUrl: c.receiptUrl,
    incurredAt: c.incurredAt.toISOString(),
    createdById: c.createdById,
    createdByName: displayName(c.createdBy),
    createdAt: c.createdAt.toISOString(),
    stageInstanceId: c.stageInstanceId ?? null,
    stageName: c.stageInstance?.stage?.name ?? null,
    locationId: c.locationId ?? null,
    locationName: c.location?.name ?? null,
    quoteLineId: c.quoteLineId ?? null,
    quoteLineDescription: c.quoteLine?.description ?? null,
    quoteLineSellPrice: c.quoteLine
      ? new Prisma.Decimal(c.quoteLine.unitPrice)
          .mul(new Prisma.Decimal(c.quoteLine.quantity))
          .toFixed(2)
      : null,
    quoteVersion: c.quoteLine?.quote?.version ?? null,
  };
}

const QUOTE_LINE_INCLUDE = {
  select: {
    id: true,
    description: true,
    unitPrice: true,
    quantity: true,
    quote: { select: { version: true } },
  },
} as const;

export class CostRepository {
  async create(
    factoryId: string,
    actorUserId: string,
    input: CostInputType,
  ) {
    return db.$transaction(async (tx) => {
      const txc = tx as unknown as TxWithCost;
      const project = await tx.project.findFirst({
        where: { id: input.projectId, factoryId },
        select: { id: true, code: true, name: true },
      });

      if (!project) {
        throw new Error("Project not found.");
      }

      if (input.taskId) {
        const task = await tx.projectTask.findFirst({
          where: { id: input.taskId, factoryId, projectId: input.projectId },
          select: { id: true },
        });
        if (!task) {
          throw new Error("Task not found for this project.");
        }
      }

      const cost = await txc.projectCost.create({
        data: {
          factoryId,
          projectId: input.projectId,
          taskId: input.taskId || null,
          category: input.category,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          description: input.description,
          vendorName: input.vendorName || null,
          receiptUrl: input.receiptUrl || null,
          incurredAt: new Date(input.incurredAt),
          createdById: actorUserId,
          stageInstanceId: input.stageInstanceId ?? null,
          locationId: input.locationId ?? null,
          quoteLineId: input.quoteLineId ?? null,
        } as never,
        include: {
          createdBy: true,
          stageInstance: { include: { stage: true } },
          location: true,
          quoteLine: QUOTE_LINE_INCLUDE,
        },
      });

      const amountStr = decToString(cost.amount);
      const message = `أُضيفت تكلفة: ${input.category} ${amountStr} ر.س — ${input.description}`;

      await tx.projectActivity.create({
        data: {
          factoryId,
          projectId: input.projectId,
          taskId: input.taskId || null,
          actorUserId,
          // Until generate runs the enum literal isn't typed yet.
          type: "COST_ADDED" as never,
          message,
          ...(input.stageInstanceId
            ? { stageInstanceId: input.stageInstanceId }
            : {}),
        } as never,
      });

      return mapCost(cost);
    });
  }

  async deleteById(
    factoryId: string,
    actorUserId: string,
    costId: string,
  ) {
    return db.$transaction(async (tx) => {
      const txc = tx as unknown as TxWithCost;
      const cost = await txc.projectCost.findFirst({
        where: { id: costId, factoryId },
      });
      if (!cost) {
        throw new Error("Cost not found.");
      }
      await txc.projectCost.delete({ where: { id: cost.id } });

      const amountStr = decToString(cost.amount);
      const message = `حُذفت تكلفة: ${cost.category} ${amountStr} ر.س — ${cost.description}`;

      await tx.projectActivity.create({
        data: {
          factoryId,
          projectId: cost.projectId,
          taskId: cost.taskId,
          actorUserId,
          type: "COST_DELETED" as never,
          message,
          ...(cost.stageInstanceId
            ? { stageInstanceId: cost.stageInstanceId }
            : {}),
        } as never,
      });

      return { id: cost.id };
    });
  }

  async listByProject(
    factoryId: string,
    projectId: string,
  ): Promise<CostListItem[]> {
    const dbc = db as unknown as DbWithCost;
    const costs = await dbc.projectCost.findMany({
      where: { factoryId, projectId },
      include: {
        createdBy: true,
        stageInstance: { include: { stage: true } },
        location: true,
        quoteLine: QUOTE_LINE_INCLUDE,
      },
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    });
    return costs.map(mapCost);
  }

  async listByFactory(
    factoryId: string,
    filters?: { from?: Date; to?: Date; categories?: CostCategory[] },
  ): Promise<CostListItem[]> {
    const where: Record<string, unknown> = { factoryId };
    if (filters?.from || filters?.to) {
      const range: { gte?: Date; lte?: Date } = {};
      if (filters.from) range.gte = filters.from;
      if (filters.to) range.lte = filters.to;
      where.incurredAt = range;
    }
    if (filters?.categories && filters.categories.length > 0) {
      where.category = { in: filters.categories };
    }
    const dbc = db as unknown as DbWithCost;
    const costs = await dbc.projectCost.findMany({
      where,
      include: {
        createdBy: true,
        stageInstance: { include: { stage: true } },
      },
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
    return costs.map(mapCost);
  }

  async summaryByProject(
    factoryId: string,
    projectId: string,
  ): Promise<ProjectCostSummary> {
    const project = await db.project.findFirst({
      where: { id: projectId, factoryId },
      include: {
        tasks: { select: { id: true, status: true } },
        order: { select: { quotedAmount: true } },
      },
    });
    if (!project) {
      throw new Error("Project not found.");
    }
    const dbc = db as unknown as DbWithCost;
    const costs = (await dbc.projectCost.findMany({
      where: { factoryId, projectId },
      select: {
        category: true,
        amount: true,
        stageInstanceId: true,
      },
    })) as unknown as {
      category: CostCategory;
      amount: Prisma.Decimal;
      stageInstanceId: string | null;
    }[];

    const byCat = emptyByCategory();
    const byStage = new Map<string | null, Prisma.Decimal>();
    let total = new Prisma.Decimal(0);
    for (const c of costs) {
      total = total.plus(c.amount);
      byCat[c.category] = new Prisma.Decimal(byCat[c.category]).plus(c.amount).toFixed(2);
      const k = c.stageInstanceId ?? null;
      byStage.set(k, (byStage.get(k) ?? new Prisma.Decimal(0)).plus(c.amount));
    }

    // Stage labels — fetched once via the same db client.
    const dbAny = db as unknown as {
      projectStageInstance: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          sortOrder?: number;
          stage: { name: string; sortOrder: number };
        }>>;
      };
    };
    const stageInstances = await dbAny.projectStageInstance.findMany({
      where: { factoryId, projectId },
      include: { stage: true },
      orderBy: { stage: { sortOrder: "asc" } },
    });
    const stageNameById = new Map<string, { name: string; order: number }>(
      stageInstances.map((s) => [s.id, { name: s.stage.name, order: s.stage.sortOrder }]),
    );

    const totalNum = Number(total.toFixed(2));
    const costsByStage = Array.from(byStage.entries()).map(([id, amount]) => {
      const meta = id ? stageNameById.get(id) : null;
      const amt = Number(amount.toFixed(2));
      return {
        stageInstanceId: id,
        stageName: meta?.name ?? "بدون مرحلة",
        order: meta?.order ?? Number.MAX_SAFE_INTEGER - 1,
        total: amount.toFixed(2),
        pct: totalNum === 0 ? 0 : (amt / totalNum) * 100,
      };
    });
    costsByStage.sort((a, b) => a.order - b.order);
    const costsByStageOut = costsByStage.map(({ stageInstanceId, stageName, total, pct }) => ({
      stageInstanceId,
      stageName,
      total,
      pct,
    }));

    const projectWithOrder = project as typeof project & {
      order: { quotedAmount: Prisma.Decimal | null } | null;
    };
    const quoted = projectWithOrder.order?.quotedAmount ?? null;
    const margin = quoted ? new Prisma.Decimal(quoted).minus(total) : null;

    const totalTasks = project.tasks.length;
    const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
    const completionPercent = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

    return {
      projectId,
      totalCost: total.toFixed(2),
      costsByCategory: byCat,
      costsByStage: costsByStageOut,
      quotedAmount: quoted ? new Prisma.Decimal(quoted).toFixed(2) : null,
      marginExpected: margin ? margin.toFixed(2) : null,
      completionPercent,
    };
  }

  async summaryByFactory(
    factoryId: string,
    filters?: { from?: Date; to?: Date; categories?: CostCategory[] },
  ): Promise<FactoryCostSummary> {
    // Pull all projects with their costs (using the safe delegate-cast pattern
    // for the include below).
    const projects = (await db.project.findMany({
      where: { factoryId },
      include: {
        order: {
          select: {
            quotedAmount: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })) as unknown as {
      id: string;
      code: string;
      name: string;
      status: string;
      order: {
        quotedAmount: Prisma.Decimal | null;
        customer: { name: string } | null;
      } | null;
    }[];

    // Fetch all matching costs in one pass and group by project.
    const dbc = db as unknown as DbWithCost;
    const where: Record<string, unknown> = { factoryId };
    if (filters?.from || filters?.to) {
      const range: { gte?: Date; lte?: Date } = {};
      if (filters.from) range.gte = filters.from;
      if (filters.to) range.lte = filters.to;
      where.incurredAt = range;
    }
    if (filters?.categories && filters.categories.length > 0) {
      where.category = { in: filters.categories };
    }
    const costs = (await dbc.projectCost.findMany({
      where,
      select: { projectId: true, amount: true, category: true },
      take: 5000,
    })) as unknown as {
      projectId: string;
      amount: Prisma.Decimal;
      category: CostCategory;
    }[];

    const costsByProject = new Map<string, { total: Prisma.Decimal }>();
    const byCat = emptyByCategory();
    for (const c of costs) {
      const cur = costsByProject.get(c.projectId);
      if (cur) {
        cur.total = cur.total.plus(c.amount);
      } else {
        costsByProject.set(c.projectId, { total: new Prisma.Decimal(c.amount) });
      }
      byCat[c.category] = new Prisma.Decimal(byCat[c.category]).plus(c.amount).toFixed(2);
    }

    let totalQuoted = new Prisma.Decimal(0);
    let totalCost = new Prisma.Decimal(0);
    let overBudget = 0;

    const projectRows = projects.map((p) => {
      const quoted = p.order?.quotedAmount
        ? new Prisma.Decimal(p.order.quotedAmount)
        : null;
      const pTotal = costsByProject.get(p.id)?.total ?? new Prisma.Decimal(0);

      if (quoted) totalQuoted = totalQuoted.plus(quoted);
      totalCost = totalCost.plus(pTotal);
      const margin = quoted ? quoted.minus(pTotal) : null;
      if (margin && margin.lt(0)) overBudget += 1;

      return {
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        customerName: p.order?.customer?.name ?? null,
        quotedAmount: quoted ? quoted.toFixed(2) : null,
        totalCost: pTotal.toFixed(2),
        margin: margin ? margin.toFixed(2) : null,
        status: p.status,
      };
    });

    projectRows.sort((a, b) => {
      const ma = a.margin === null ? Number.NEGATIVE_INFINITY : Number(a.margin);
      const mb = b.margin === null ? Number.NEGATIVE_INFINITY : Number(b.margin);
      return mb - ma;
    });

    return {
      totalQuoted: totalQuoted.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalMargin: totalQuoted.minus(totalCost).toFixed(2),
      overBudgetCount: overBudget,
      costsByCategory: byCat,
      projects: projectRows,
    };
  }

  async getById(factoryId: string, costId: string) {
    const dbc = db as unknown as DbWithCost;
    return dbc.projectCost.findFirst({
      where: { id: costId, factoryId },
    });
  }
}
