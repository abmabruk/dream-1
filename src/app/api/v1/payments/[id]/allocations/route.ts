export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { AllocationInput } from "@/modules/payments/payment.schemas";
import { PaymentService } from "@/modules/payments/payment.service";

const service = new PaymentService();
const Params = z.object({ id: z.string().min(1) });
const Body = z.object({ allocations: z.array(AllocationInput).min(1) });

export const POST = defineRoute({
  permission: "payments:manage",
  params: Params,
  body: Body,
  async handler({ session, params, body }) {
    const payment = await service.allocate(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body.allocations,
    );
    return ok(payment, { status: 201 });
  },
});
