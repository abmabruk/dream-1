export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();

export const POST = defineRoute({
  permission: "invoices:issue",
  params: z.object({ id: z.string().min(1) }),
  async handler({ session, params }) {
    const invoice = await service.send(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
    );
    return ok(invoice);
  },
});
