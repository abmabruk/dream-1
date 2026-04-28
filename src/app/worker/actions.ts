"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { AttendanceService } from "@/modules/attendance/attendance.service";
import { AssignmentService } from "@/modules/production/assignment.service";

import type { WorkerActionState } from "./state";

const attendanceService = new AttendanceService();
const assignmentService = new AssignmentService();

function revalidateWorkerViews() {
  revalidatePath("/worker");
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function clockInAction(
  _previousState: WorkerActionState,
  formData: FormData
): Promise<WorkerActionState> {
  try {
    const session = await requirePermission("production:view");

    await attendanceService.clockIn(
      session.factoryId,
      session.userId,
      String(formData.get("note") ?? "")
    );

    revalidateWorkerViews();

    return {
      error: null,
      success: "تم تسجيل الحضور بنجاح.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذّر تسجيل الحضور.",
      success: null,
    };
  }
}

export async function clockOutAction(
  _previousState: WorkerActionState,
  formData: FormData
): Promise<WorkerActionState> {
  try {
    const session = await requirePermission("production:view");

    await attendanceService.clockOut(
      session.factoryId,
      session.userId,
      String(formData.get("note") ?? "")
    );

    revalidateWorkerViews();

    return {
      error: null,
      success: "تم تسجيل الانصراف بنجاح.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذّر تسجيل الانصراف.",
      success: null,
    };
  }
}

export async function updateAssignmentStatusAction(
  _previousState: WorkerActionState,
  formData: FormData
): Promise<WorkerActionState> {
  try {
    const session = await requirePermission("production:view");

    await assignmentService.updateStatus(
      session.factoryId,
      session.userId,
      session.userId,
      {
        assignmentId: String(formData.get("assignmentId") ?? ""),
        status: String(formData.get("status") ?? "") as never,
        note: String(formData.get("note") ?? ""),
      }
    );

    revalidateWorkerViews();

    return {
      error: null,
      success: "تم تحديث المهمة بنجاح.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "تعذّر تحديث المهمة.",
      success: null,
    };
  }
}
