export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { VendorContactInput } from "@/modules/vendors/vendor.schemas";
import { VendorService } from "@/modules/vendors/vendor.service";

const service = new VendorService();
const ParamsSchema = z.object({ id: z.string().min(1) });

export const POST = defineRoute({
  permission: "vendors:manage",
  params: ParamsSchema,
  body: VendorContactInput,
  async handler({ session, params, body }) {
    const contact = await service.addContact(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(contact, { status: 201 });
  },
});
