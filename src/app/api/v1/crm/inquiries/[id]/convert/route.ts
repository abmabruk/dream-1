export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { ConvertInquiryInput } from "@/modules/crm/inquiry.schemas";
import { InquiryService } from "@/modules/crm/inquiry.service";

const service = new InquiryService();

export const POST = defineRoute({
  permission: "crm:manage",
  params: z.object({ id: z.string().min(1) }),
  body: ConvertInquiryInput,
  async handler({ session, params, body }) {
    const result = await service.convertToCustomer(
      session.factoryId,
      { userId: session.userId, role: session.role },
      params.id,
      body,
    );
    return ok(result, { status: 201 });
  },
});
