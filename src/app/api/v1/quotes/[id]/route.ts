export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { UpdateQuoteInput } from "@/modules/quotes/quote.schemas";
import { QuoteService } from "@/modules/quotes/quote.service";

const service = new QuoteService();
const Params = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "quotes:view",
  params: Params,
  async handler({ session, params }) {
    const quote = await service.getById(
      session.factoryId,
      session.role,
      params.id,
    );
    return ok(quote);
  },
});

export const PATCH = defineRoute({
  permission: "quotes:draft",
  params: Params,
  body: UpdateQuoteInput,
  async handler({ session, params, body }) {
    const quote = await service.update(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(quote);
  },
});

export const DELETE = defineRoute({
  permission: "quotes:draft",
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
