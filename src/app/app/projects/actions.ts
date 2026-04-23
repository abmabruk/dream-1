"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { ProjectService } from "@/modules/projects/project.service";

const projectService = new ProjectService();

export async function createProjectAction(
  _previousState: { error: string | null; message: string | null },
  formData: FormData
): Promise<{ error: string | null; message: string | null }> {
  try {
    const session = await requirePermission("projects:manage");

    await projectService.create(session.factoryId, session.userId, {
      orderId: String(formData.get("orderId") ?? "").trim() || undefined,
      ownerUserId: String(formData.get("ownerUserId") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      priority: String(formData.get("priority") ?? "MEDIUM"),
      startDate: String(formData.get("startDate") ?? "").trim() || undefined,
      dueDate: String(formData.get("dueDate") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? ""),
    });

    revalidatePath("/app/projects");
    revalidatePath("/app/ops");

    return {
      error: null,
      message: "Project created.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create project.",
      message: null,
    };
  }
}
