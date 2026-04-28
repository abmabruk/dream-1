export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { fail } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/modules/auth/api-guard";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");

    if (!access.ok) {
      return access.response;
    }

    const { id } = await context.params;

    const project = await db.project.findFirst({
      where: { id, factoryId: access.session.factoryId },
      include: {
        tasks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        costs: {
          orderBy: { incurredAt: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!project) {
      return fail("Project not found", 404);
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      project: {
        code: project.code,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate?.toISOString() ?? null,
        dueDate: project.dueDate?.toISOString() ?? null,
        notes: project.notes,
      },
      tasks: project.tasks.map((task) => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        sortOrder: task.sortOrder,
        requiresApproval: task.requiresApproval,
        assignedToUserId: task.assignedToUserId,
        dueDate: task.dueDate?.toISOString() ?? null,
      })),
      costs: project.costs.map((cost) => ({
        category: cost.category,
        amount: cost.amount.toString(),
        currency: cost.currency,
        description: cost.description,
        vendorName: cost.vendorName,
        incurredAt: cost.incurredAt.toISOString(),
      })),
      activities: project.activities.map((activity) => ({
        type: activity.type,
        message: activity.message,
        createdAt: activity.createdAt.toISOString(),
      })),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="project-${project.code}.json"`,
      },
    });
  });
}
