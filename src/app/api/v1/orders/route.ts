import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { OrderService } from "@/modules/orders/order.service";

const service = new OrderService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:view");

    if (!access.ok) {
      return access.response;
    }
    const orders = await service.list(access.session.factoryId);

    return ok(orders);
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:create");

    if (!access.ok) {
      return access.response;
    }
    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const order = await service.create(
      access.session.factoryId,
      access.session.userId,
      body
    );

    return ok(order, { status: 201 });
  });
}
