import { z } from "zod";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CustomerService } from "@/modules/customers/customer.service";

const customerService = new CustomerService();

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("customers:view");

    if (!access.ok) {
      return access.response;
    }

    const url = new URL(request.url);
    const parsed = ListQuery.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) {
      return fail("Invalid pagination parameters", 400);
    }
    const pageSize = parsed.data.pageSize ?? 50;
    const page = parsed.data.page ?? 1;
    const skip = (page - 1) * pageSize;

    const customers = await customerService.list(access.session.factoryId, {
      take: pageSize,
      skip,
    });

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

    const customer = await customerService.create(
      access.session.factoryId,
      body,
    );

    return ok(customer, { status: 201 });
  });
}
