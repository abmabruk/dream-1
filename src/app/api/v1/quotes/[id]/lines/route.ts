export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { QuoteLineInput } from "@/modules/quotes/quote.schemas";
import { QuoteService } from "@/modules/quotes/quote.service";

const service = new QuoteService();
const Params = z.object({ id: z.string().min(1) });

export const POST = defineRoute({
  permission: "quotes:draft",
  params: Params,
  body: QuoteLineInput,
  async handler({ session, params, body }) {
    const line = await service.addLine(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(line, { status: 201 });
  },
});

export const PUT = defineRoute({
  permission: "quotes:draft",
  params: Params,
  body: z.object({ orderedLineIds: z.array(z.string()).min(1) }),
  async handler({ session, params, body }) {
    const result = await service.reorderLines(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body.orderedLineIds,
    );
    return ok(result);
  },
});
