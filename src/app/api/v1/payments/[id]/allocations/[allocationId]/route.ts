export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { PaymentService } from "@/modules/payments/payment.service";

const service = new PaymentService();
const Params = z.object({
  id: z.string().min(1),
  allocationId: z.string().min(1),
});

export const DELETE = defineRoute({
  permission: "payments:manage",
  params: Params,
  async handler({ session, params }) {
    const payment = await service.removeAllocation(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.allocationId,
    );
    return ok(payment);
  },
});
