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

export async function GET(_request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:view");

    if (!access.ok) {
      return access.response;
    }

    const { id } = await context.params;
    const order = await orderService.getById(access.session.factoryId, id);

    if (!order) {
      return fail("Order not found", 404);
    }

    return ok(order);
  });
}
