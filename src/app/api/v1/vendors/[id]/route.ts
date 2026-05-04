export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { UpdateVendorInput } from "@/modules/vendors/vendor.schemas";
import { VendorService } from "@/modules/vendors/vendor.service";

const service = new VendorService();
const ParamsSchema = z.object({ id: z.string().min(1) });

export const GET = defineRoute({
  permission: "vendors:view",
  params: ParamsSchema,
  async handler({ session, params }) {
    const vendor = await service.getById(session.factoryId, session.role, params.id);
    return ok(vendor);
  },
});

export const PATCH = defineRoute({
  permission: "vendors:manage",
  params: ParamsSchema,
  body: UpdateVendorInput,
  async handler({ session, params, body }) {
    const vendor = await service.update(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(vendor);
  },
});

export const DELETE = defineRoute({
  permission: "vendors:manage",
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
