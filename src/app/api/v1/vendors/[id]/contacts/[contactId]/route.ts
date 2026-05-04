export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { VendorContactInput } from "@/modules/vendors/vendor.schemas";
import { VendorService } from "@/modules/vendors/vendor.service";

const service = new VendorService();
const ParamsSchema = z.object({
  id: z.string().min(1),
  contactId: z.string().min(1),
});

export const PATCH = defineRoute({
  permission: "vendors:manage",
  params: ParamsSchema,
  body: VendorContactInput.partial(),
  async handler({ session, params, body }) {
    const contact = await service.updateContact(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.contactId,
      body,
    );
    return ok(contact);
  },
});

export const DELETE = defineRoute({
  permission: "vendors:manage",
  params: ParamsSchema,
  async handler({ session, params }) {
    await service.deleteContact(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      params.contactId,
    );
    return ok({ id: params.contactId, deleted: true });
  },
});
