"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { ProjectService } from "@/modules/projects/project.service";

const projectService = new ProjectService();

export async function createProjectTaskAction(
  _previousState: { error: string | null; message: string | null },
  formData: FormData
): Promise<{ error: string | null; message: string | null }> {
  try {
    const session = await requirePermission("projects:manage");
    const projectId = String(formData.get("projectId") ?? "");

    await projectService.createTask(session.factoryId, session.userId, {
      projectId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      priority: String(formData.get("priority") ?? "MEDIUM"),
      assignedToUserId: String(formData.get("assignedToUserId") ?? "").trim() || undefined,
      dueDate: String(formData.get("dueDate") ?? "").trim() || undefined,
      requiresApproval: String(formData.get("requiresApproval") ?? "") === "on",
      stageInstanceId:
        String(formData.get("stageInstanceId") ?? "").trim() || undefined,
      locationId:
        String(formData.get("locationId") ?? "").trim() || undefined,
    });

    revalidatePath(`/app/projects/${projectId}`);
    revalidatePath("/app/projects");
    revalidatePath("/app/ops");

    return {
      error: null,
      message: "تم إنشاء المهمة بنجاح",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذّر إنشاء المهمة.",
      message: null,
    };
  }
}

export async function addTaskToTodayAction(formData: FormData) {
  const session = await requirePermission("ops:manage");
  const projectId = String(formData.get("projectId") ?? "");

  await projectService.addTaskToToday(session.factoryId, session.userId, {
    taskId: String(formData.get("taskId") ?? ""),
    workDate: String(formData.get("workDate") ?? ""),
    assignedToUserId: String(formData.get("assignedToUserId") ?? "").trim() || undefined,
  });

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/projects");
  revalidatePath("/app/ops");
}
