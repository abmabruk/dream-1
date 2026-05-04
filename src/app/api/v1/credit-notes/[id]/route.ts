export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CreditNoteService } from "@/modules/invoices/credit-note.service";

const service = new CreditNoteService();

export const GET = defineRoute({
  permission: "invoices:view",
  params: z.object({ id: z.string().min(1) }),
  async handler({ session, params }) {
    const note = await service.getById(
      session.factoryId,
      session.role,
      params.id,
    );
    return ok(note);
  },
});
