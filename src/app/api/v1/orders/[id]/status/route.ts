import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { OrderService } from "@/modules/orders/order.service";

const orderService = new OrderService();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:update");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { id } = await context.params;
    const order = await orderService.updateStatus(access.session.factoryId, access.session.userId, {
      orderId: id,
      status: body.status,
      note: body.note,
    });

    return ok(order);
  });
}
