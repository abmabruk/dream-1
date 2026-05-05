export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { VariantInput } from "@/modules/products/product.schemas";
import { ProductService } from "@/modules/products/product.service";

const service = new ProductService();
const ParamsSchema = z.object({
  id: z.string().min(1),
  variantId: z.string().min(1),
});

export const PATCH = defineRoute({
  permission: "products:manage",
  params: ParamsSchema,
  body: VariantInput.partial(),
  async handler({ session, params, body }) {
    const variant = await service.updateVariant(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.variantId,
      body,
    );
    return ok(variant);
  },
});

export const DELETE = defineRoute({
  permission: "products:manage",
  params: ParamsSchema,
  async handler({ session, params }) {
    await service.deleteVariant(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.variantId,
    );
    return ok({ id: params.variantId, deleted: true });
  },
});
