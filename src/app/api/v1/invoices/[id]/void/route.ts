export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();

export const POST = defineRoute({
  permission: "invoices:void",
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ reason: z.string().min(2).max(500) }),
  async handler({ session, params, body }) {
    const invoice = await service.void(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body.reason,
    );
    return ok(invoice);
  },
});
