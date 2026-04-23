import { withRouteErrorHandling } from "@/lib/http/route";
import { fail, ok } from "@/lib/http/api-response";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { UserService } from "@/modules/users/user.service";

const userService = new UserService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("users:manage");

    if (!access.ok) {
      return access.response;
    }

    const users = await userService.list(access.session.factoryId);

    return ok(users);
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("users:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const user = await userService.create(
      access.session.factoryId,
      {
        userId: access.session.userId,
        role: access.session.role,
      },
      body
    );

    return ok(user, { status: 201 });
  });
}
