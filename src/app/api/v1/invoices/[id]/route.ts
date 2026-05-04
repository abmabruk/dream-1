export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { UpdateInvoiceInput } from "@/modules/invoices/invoice.schemas";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();
const Params = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "invoices:view",
  params: Params,
  async handler({ session, params }) {
    const invoice = await service.getById(
      session.factoryId,
      session.role,
      params.id,
    );
    return ok(invoice);
  },
});

export const PATCH = defineRoute({
  permission: "invoices:manage",
  params: Params,
  body: UpdateInvoiceInput,
  async handler({ session, params, body }) {
    const invoice = await service.update(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(invoice);
  },
});

export const DELETE = defineRoute({
  permission: "invoices:manage",
  params: Params,
  async handler({ session, params }) {
    await service.softDelete(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
    );
    return ok({ id: params.id });
  },
});
