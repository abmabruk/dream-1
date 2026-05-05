export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CreateProductInput } from "@/modules/products/product.schemas";
import { ProductService } from "@/modules/products/product.service";

const service = new ProductService();

export const GET = defineRoute({
  permission: "products:view",
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    deletedFilter: z.enum(["active", "deleted", "all"]).optional(),
  }),
  async handler({ session, query }) {
    const tags = Array.isArray(query.tags)
      ? query.tags
      : query.tags
        ? [query.tags]
        : undefined;
    const products = await service.list(session.factoryId, session.role, {
      search: query.search,
      category: query.category,
      tags,
      deletedFilter: query.deletedFilter,
    });
    return ok(products);
  },
});

export const POST = defineRoute({
  permission: "products:manage",
  body: CreateProductInput,
  async handler({ session, body }) {
    const product = await service.create(
      session.factoryId,
      { userId: session.userId, role: session.role },
      body,
    );
    return ok(product, { status: 201 });
  },
});
