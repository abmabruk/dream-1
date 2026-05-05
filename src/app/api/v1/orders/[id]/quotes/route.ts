export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CreateQuoteInput } from "@/modules/quotes/quote.schemas";
import { QuoteService } from "@/modules/quotes/quote.service";

const service = new QuoteService();

const Params = z.object({ id: z.string().min(1) });
const CreateBody = CreateQuoteInput.omit({ orderId: true });

export const GET = defineRoute({
  permission: "quotes:view",
  params: Params,
  async handler({ session, params }) {
    const quotes = await service.listByOrder(
      session.factoryId,
      session.role,
      params.id,
    );
    return ok(quotes);
  },
});

export const POST = defineRoute({
  permission: "quotes:draft",
  params: Params,
  body: CreateBody,
  async handler({ session, params, body }) {
    const quote = await service.create(
      session.factoryId,
      { userId: session.userId, role: session.role },
      { ...body, orderId: params.id },
    );
    return ok(quote, { status: 201 });
  },
});
