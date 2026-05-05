export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CreateCreditNoteInput } from "@/modules/invoices/invoice.schemas";
import { CreditNoteService } from "@/modules/invoices/credit-note.service";

const service = new CreditNoteService();
const Params = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "invoices:view",
  params: Params,
  async handler({ session, params }) {
    const notes = await service.listByInvoice(
      session.factoryId,
      session.role,
      params.id,
    );
    return ok(notes);
  },
});

export const POST = defineRoute({
  permission: "credit-notes:manage",
  params: Params,
  body: CreateCreditNoteInput,
  async handler({ session, params, body }) {
    const note = await service.create(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(note, { status: 201 });
  },
});
