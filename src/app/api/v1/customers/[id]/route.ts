export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CustomerService } from "@/modules/customers/customer.service";
import { updateCustomerSchema } from "@/modules/customers/customer.schemas";

const service = new CustomerService();
const Params = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "customers:view",
  params: Params,
  async handler({ session, params }) {
    const customer = await service.getById(session.factoryId, params.id);
    return ok(customer);
  },
});

export const PATCH = defineRoute({
  permission: "customers:manage",
  params: Params,
  body: updateCustomerSchema,
  async handler({ session, params, body }) {
    const customer = await service.update(session.factoryId, params.id, body);
    return ok(customer);
  },
});

export const DELETE = defineRoute({
  permission: "customers:manage",
  params: Params,
  async handler({ session, params }) {
    const result = await service.delete(session.factoryId, params.id);
    return ok(result);
  },
});
