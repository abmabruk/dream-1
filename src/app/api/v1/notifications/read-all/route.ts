import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { NotificationService } from "@/modules/notifications/notification.service";

const notificationService = new NotificationService();

export async function POST() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("notifications:view");

    if (!access.ok) {
      return access.response;
    }

    const result = await notificationService.markAllRead(
      access.session.factoryId,
      access.session.userId
    );

    return ok(result);
  });
}
