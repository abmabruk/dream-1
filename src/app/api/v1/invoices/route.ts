export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import {
  CreateInvoiceInput,
  InvoiceStatusEnum,
} from "@/modules/invoices/invoice.schemas";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();

const ListQuery = z.object({
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  quoteId: z.string().optional(),
  status: InvoiceStatusEnum.optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const GET = defineRoute({
  permission: "invoices:view",
  query: ListQuery,
  async handler({ session, query }) {
    const pageSize = query.pageSize ?? query.limit ?? 50;
    const page = query.page ?? 1;
    const skip = (page - 1) * pageSize;
    const result = await service.list(session.factoryId, session.role, {
      ...query,
      take: pageSize,
      skip,
    });
    return ok(result);
  },
});

export const POST = defineRoute({
  permission: "invoices:manage",
  body: CreateInvoiceInput,
  async handler({ session, body }) {
    const invoice = await service.create(
      session.factoryId,
      { userId: session.userId, role: session.role },
      body,
    );
    return ok(invoice, { status: 201 });
  },
});
