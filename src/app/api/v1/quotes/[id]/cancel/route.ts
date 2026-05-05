export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { QuoteService } from "@/modules/quotes/quote.service";

const service = new QuoteService();

export const POST = defineRoute({
  permission: "quotes:cancel",
  params: z.object({ id: z.string().min(1) }),
  async handler({ session, params }) {
    const quote = await service.cancel(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
    );
    return ok(quote);
  },
});
