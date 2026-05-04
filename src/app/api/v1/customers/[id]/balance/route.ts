export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { PaymentService } from "@/modules/payments/payment.service";

const service = new PaymentService();
const Params = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "payments:view",
  params: Params,
  async handler({ session, params }) {
    const balance = await service.getCustomerBalance(
      session.factoryId,
      params.id,
    );
    return ok({ customerId: params.id, currency: "SAR", ...balance });
  },
});
