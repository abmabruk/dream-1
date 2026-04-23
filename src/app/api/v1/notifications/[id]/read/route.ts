import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { NotificationService } from "@/modules/notifications/notification.service";

const notificationService = new NotificationService();

type NotificationReadRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  context: NotificationReadRouteContext
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("notifications:view");

    if (!access.ok) {
      return access.response;
    }

    const { id } = await context.params;
    await notificationService.markRead(
      access.session.factoryId,
      access.session.userId,
      id
    );

    return ok({ id });
  });
}
