"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { ProjectService } from "@/modules/projects/project.service";

const projectService = new ProjectService();

function revalidateOps(projectId?: string | null) {
  revalidatePath("/app/ops");

  if (projectId) {
    revalidatePath(`/app/projects/${projectId}`);
  }

  revalidatePath("/app/projects");
}

export async function moveQueueItemAction(formData: FormData) {
  const session = await requirePermission("ops:manage");
  const projectId = String(formData.get("projectId") ?? "").trim() || null;

  await projectService.moveQueueItem(session.factoryId, session.userId, {
    queueItemId: String(formData.get("queueItemId") ?? ""),
    direction: String(formData.get("direction") ?? "up"),
  });

  revalidateOps(projectId);
}

export async function updateQueueItemStatusAction(formData: FormData) {
  const session = await requirePermission("ops:manage");
  const projectId = String(formData.get("projectId") ?? "").trim() || null;

  await projectService.updateQueueItem(session.factoryId, session.userId, {
    queueItemId: String(formData.get("queueItemId") ?? ""),
    status: String(formData.get("status") ?? "PLANNED"),
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });

  revalidateOps(projectId);
}

export async function reviewTaskAction(formData: FormData) {
  const session = await requirePermission("ops:manage");
  const projectId = String(formData.get("projectId") ?? "").trim() || null;

  await projectService.reviewTask(
    session.factoryId,
    {
      userId: session.userId,
      role: session.role,
    },
    {
      taskId: String(formData.get("taskId") ?? ""),
      decision: String(formData.get("decision") ?? "approve"),
      note: String(formData.get("note") ?? "").trim() || undefined,
    }
  );

  revalidateOps(projectId);
}
