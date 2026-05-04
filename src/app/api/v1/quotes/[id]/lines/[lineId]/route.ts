export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { QuoteLineInput } from "@/modules/quotes/quote.schemas";
import { QuoteService } from "@/modules/quotes/quote.service";

const service = new QuoteService();
const Params = z.object({
  id: z.string().min(1),
  lineId: z.string().min(1),
});

export const PATCH = defineRoute({
  permission: "quotes:draft",
  params: Params,
  body: QuoteLineInput,
  async handler({ session, params, body }) {
    const line = await service.updateLine(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.lineId,
      body,
    );
    return ok(line);
  },
});

export const DELETE = defineRoute({
  permission: "quotes:draft",
  params: Params,
  async handler({ session, params }) {
    await service.deleteLine(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.lineId,
    );
    return ok({ id: params.lineId });
  },
});
