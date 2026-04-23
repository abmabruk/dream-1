import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { UserService } from "@/modules/users/user.service";

const userService = new UserService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("users:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { id } = await params;
    const user = await userService.updateManagedUser(
      access.session.factoryId,
      {
        userId: access.session.userId,
        role: access.session.role,
      },
      {
        userId: id,
        role: body.role,
        status: body.status,
      }
    );

    return ok(user);
  });
}
