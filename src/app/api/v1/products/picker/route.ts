export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { ProductService } from "@/modules/products/product.service";

const service = new ProductService();

export const GET = defineRoute({
  permission: "products:view",
  query: z.object({
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
  async handler({ session, query }) {
    const items = await service.searchForPicker(
      session.factoryId,
      session.role,
      query.search ?? "",
      query.limit,
    );
    return ok(items);
  },
});
