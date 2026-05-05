export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { UpdateProductInput } from "@/modules/products/product.schemas";
import { ProductService } from "@/modules/products/product.service";

const service = new ProductService();
const ParamsSchema = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "products:view",
  params: ParamsSchema,
  async handler({ session, params }) {
    const product = await service.getById(session.factoryId, session.role, params.id);
    return ok(product);
  },
});

export const PATCH = defineRoute({
  permission: "products:manage",
  params: ParamsSchema,
  body: UpdateProductInput,
  async handler({ session, params, body }) {
    const product = await service.update(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(product);
  },
});

export const DELETE = defineRoute({
  permission: "products:manage",
  params: ParamsSchema,
  async handler({ session, params }) {
    await service.softDelete(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
    );
    return ok({ id: params.id, deleted: true });
  },
});
