export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { UpdatePaymentInput } from "@/modules/payments/payment.schemas";
import { PaymentService } from "@/modules/payments/payment.service";

const service = new PaymentService();
const Params = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "payments:view",
  params: Params,
  async handler({ session, params }) {
    const payment = await service.getById(
      session.factoryId,
      session.role,
      params.id,
    );
    return ok(payment);
  },
});

export const PATCH = defineRoute({
  permission: "payments:manage",
  params: Params,
  body: UpdatePaymentInput,
  async handler({ session, params, body }) {
    const payment = await service.update(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(payment);
  },
});

export const DELETE = defineRoute({
  permission: "payments:manage",
  params: Params,
  async handler({ session, params }) {
    const result = await service.softDelete(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
    );
    return ok(result);
  },
});
