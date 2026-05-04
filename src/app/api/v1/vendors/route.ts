export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CreateVendorInput } from "@/modules/vendors/vendor.schemas";
import { VendorService } from "@/modules/vendors/vendor.service";

const service = new VendorService();

export const GET = defineRoute({
  permission: "vendors:view",
  query: z.object({
    search: z.string().optional(),
    deletedFilter: z.enum(["active", "deleted", "all"]).optional(),
  }),
  async handler({ session, query }) {
    const vendors = await service.list(session.factoryId, session.role, query);
    return ok(vendors);
  },
});

export const POST = defineRoute({
  permission: "vendors:manage",
  body: CreateVendorInput,
  async handler({ session, body }) {
    const vendor = await service.create(
      session.factoryId,
      { userId: session.userId, role: session.role },
      body,
    );
    return ok(vendor, { status: 201 });
  },
});
