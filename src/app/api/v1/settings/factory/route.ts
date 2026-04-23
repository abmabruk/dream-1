import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { SettingsService } from "@/modules/settings/settings.service";

const settingsService = new SettingsService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("settings:manage");

    if (!access.ok) {
      return access.response;
    }

    const settings = await settingsService.get(access.session.factoryId);

    return ok(settings);
  });
}

export async function PATCH(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("settings:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const settings = await settingsService.update(access.session.factoryId, body);

    return ok(settings);
  });
}
