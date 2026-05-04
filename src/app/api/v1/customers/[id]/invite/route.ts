export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CustomerService } from "@/modules/customers/customer.service";

const service = new CustomerService();
const Params = z.object({ id: z.string().min(1) });

export const POST = defineRoute({
  permission: "customers:manage",
  params: Params,
  async handler({ session, params }) {
    const result = await service.inviteCustomer(session.factoryId, params.id, {
      userId: session.userId,
      role: session.role,
    });
    return ok(result);
  },
});
