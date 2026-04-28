export const dynamic = "force-dynamic";

import { z } from "zod";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/modules/auth/api-guard";
import {
  projectPrioritySchema,
  projectStatusSchema,
  projectTaskStatusSchema,
} from "@/modules/projects/project.schemas";

const importPayloadSchema = z.object({
  version: z.number().optional(),
  project: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    status: projectStatusSchema.optional(),
    priority: projectPrioritySchema.optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        priority: projectPrioritySchema.optional(),
        status: projectTaskStatusSchema.optional(),
        sortOrder: z.number().optional(),
        requiresApproval: z.boolean().optional(),
        assignedToUserId: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
      })
    )
    .optional(),
  costs: z
    .array(
      z.object({
        category: z.string(),
        amount: z.string(),
        currency: z.string().optional(),
        description: z.string(),
        vendorName: z.string().nullable().optional(),
        incurredAt: z.string(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const includeCosts =
      new URL(request.url).searchParams.get("includeCosts") === "true";
    const parsed = importPayloadSchema.parse(body);
    const factoryId = access.session.factoryId;

    // Generate a unique code by suffixing -COPY (and -COPY-2, -COPY-3, ...)
    // until we find a slot the factory hasn't used.
    const baseCode = `${parsed.project.code}-COPY`;
    let code = baseCode;
    let suffix = 1;
    while (
      await db.project.findFirst({
        where: { factoryId, code },
        select: { id: true },
      })
    ) {
      suffix += 1;
      code = `${baseCode}-${suffix}`;
    }

    const result = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          factoryId,
          code,
          name: parsed.project.name,
          description: parsed.project.description ?? null,
          priority: parsed.project.priority ?? "MEDIUM",
          status: "PLANNING",
          startDate: parsed.project.startDate
            ? new Date(parsed.project.startDate)
            : null,
          dueDate: parsed.project.dueDate
            ? new Date(parsed.project.dueDate)
            : null,
          notes: parsed.project.notes ?? null,
        },
      });

      await tx.projectActivity.create({
        data: {
          factoryId,
          projectId: project.id,
          actorUserId: access.session.userId,
          type: "PROJECT_CREATED",
          message: `Project ${project.code} imported from ${parsed.project.code}.`,
        },
      });

      if (parsed.tasks && parsed.tasks.length > 0) {
        for (let index = 0; index < parsed.tasks.length; index += 1) {
          const task = parsed.tasks[index];
          await tx.projectTask.create({
            data: {
              factoryId,
              projectId: project.id,
              title: task.title,
              description: task.description ?? null,
              priority: task.priority ?? "MEDIUM",
              status: "BACKLOG",
              sortOrder: task.sortOrder ?? index,
              requiresApproval: task.requiresApproval ?? false,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
            },
          });
        }
      }

      if (includeCosts && parsed.costs && parsed.costs.length > 0) {
        const validCategories = ["MATERIAL", "LABOR", "SERVICE", "OVERHEAD", "OTHER"];
        for (const cost of parsed.costs) {
          const category = validCategories.includes(cost.category)
            ? (cost.category as "MATERIAL" | "LABOR" | "SERVICE" | "OVERHEAD" | "OTHER")
            : "OTHER";
          await tx.projectCost.create({
            data: {
              factoryId,
              projectId: project.id,
              category,
              amount: cost.amount,
              currency: cost.currency ?? "SAR",
              description: cost.description,
              vendorName: cost.vendorName ?? null,
              incurredAt: new Date(cost.incurredAt),
              createdById: access.session.userId,
            },
          });
        }
      }

      return project;
    });

    return ok(result, { status: 201 });
  });
}
