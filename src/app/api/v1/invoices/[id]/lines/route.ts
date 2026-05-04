export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { InvoiceLineInput } from "@/modules/invoices/invoice.schemas";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();

export const POST = defineRoute({
  permission: "invoices:manage",
  params: z.object({ id: z.string().min(1) }),
  body: InvoiceLineInput,
  async handler({ session, params, body }) {
    const invoice = await service.addLine(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(invoice, { status: 201 });
  },
});
