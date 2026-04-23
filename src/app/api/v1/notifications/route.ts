import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { NotificationService } from "@/modules/notifications/notification.service";

const notificationService = new NotificationService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("notifications:view");

    if (!access.ok) {
      return access.response;
    }

    const notifications = await notificationService.getFeed({
      factoryId: access.session.factoryId,
      userId: access.session.userId,
      role: access.session.role,
    });

    return ok(notifications);
  });
}
