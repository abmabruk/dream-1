export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { VariantInput } from "@/modules/products/product.schemas";
import { ProductService } from "@/modules/products/product.service";

const service = new ProductService();
const ParamsSchema = z.object({ id: z.string().min(1) });

export const POST = defineRoute({
  permission: "products:manage",
  params: ParamsSchema,
  body: VariantInput,
  async handler({ session, params, body }) {
    const variant = await service.addVariant(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(variant, { status: 201 });
  },
});
