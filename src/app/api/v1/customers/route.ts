import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CustomerService } from "@/modules/customers/customer.service";

const customerService = new CustomerService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("orders:view");

    if (!access.ok) {
      return access.response;
    }

    const customers = await customerService.list(access.session.factoryId);

    return ok(customers);
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

    const customer = await customerService.create(access.session.factoryId, body);

    return ok(customer, { status: 201 });
  });
}
