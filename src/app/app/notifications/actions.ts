"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { NotificationService } from "@/modules/notifications/notification.service";

const notificationService = new NotificationService();

function revalidateNotificationViews() {
  revalidatePath("/app");
  revalidatePath("/app/notifications");
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await requirePermission("notifications:view");

  await notificationService.markRead(
    session.factoryId,
    session.userId,
    String(formData.get("notificationId") ?? "")
  );

  revalidateNotificationViews();
}

export async function markAllNotificationsReadAction() {
  const session = await requirePermission("notifications:view");

  await notificationService.markAllRead(session.factoryId, session.userId);

  revalidateNotificationViews();
}
