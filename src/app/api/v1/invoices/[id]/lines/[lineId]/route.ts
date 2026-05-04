export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { InvoiceLineInput } from "@/modules/invoices/invoice.schemas";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();
const Params = z.object({
  id: z.string().min(1),
  lineId: z.string().min(1),
});

export const PATCH = defineRoute({
  permission: "invoices:manage",
  params: Params,
  body: InvoiceLineInput.partial(),
  async handler({ session, params, body }) {
    const invoice = await service.updateLine(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.lineId,
      body,
    );
    return ok(invoice);
  },
});

export const DELETE = defineRoute({
  permission: "invoices:manage",
  params: Params,
  async handler({ session, params }) {
    const invoice = await service.deleteLine(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.lineId,
    );
    return ok(invoice);
  },
});
