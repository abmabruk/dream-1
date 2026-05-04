export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CreditNoteService } from "@/modules/invoices/credit-note.service";

const service = new CreditNoteService();

export const POST = defineRoute({
  permission: "invoices:void",
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ reason: z.string().min(2).max(500) }),
  async handler({ session, params, body }) {
    const note = await service.void(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body.reason,
    );
    return ok(note);
  },
});
