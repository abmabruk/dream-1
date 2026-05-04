export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import {
  PaymentKindEnum,
  RecordPaymentInput,
} from "@/modules/payments/payment.schemas";
import { PaymentService } from "@/modules/payments/payment.service";

const service = new PaymentService();

const ListQuery = z.object({
  customerId: z.string().optional(),
  kind: PaymentKindEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const GET = defineRoute({
  permission: "payments:view",
  query: ListQuery,
  async handler({ session, query }) {
    const result = await service.list(session.factoryId, session.role, query);
    return ok(result);
  },
});

export const POST = defineRoute({
  permission: "payments:manage",
  body: RecordPaymentInput,
  async handler({ session, body }) {
    const payment = await service.record(
      session.factoryId,
      { userId: session.userId, role: session.role },
      body,
    );
    return ok(payment, { status: 201 });
  },
});
