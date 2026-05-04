export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();

export const POST = defineRoute({
  permission: "invoices:manage",
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      dueDate: z.string().optional(),
    })
    .optional()
    .default({}),
  async handler({ session, params, body }) {
    const invoice = await service.generateFromQuote(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      { dueDate: body?.dueDate ? new Date(body.dueDate) : undefined },
    );
    return ok(invoice, { status: 201 });
  },
});
