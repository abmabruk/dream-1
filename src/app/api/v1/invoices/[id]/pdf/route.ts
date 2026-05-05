export const dynamic = "force-dynamic";

import { z } from "zod";

import { defineRoute } from "@/lib/http/with-validation";
import { renderInvoiceHtml } from "@/lib/pdf/invoice-pdf";
import { InvoiceService } from "@/modules/invoices/invoice.service";

const service = new InvoiceService();
const Params = z.object({ id: z.string().min(1) });

/**
 * GET /api/v1/invoices/:id/pdf
 *
 * Returns a print-friendly HTML rendering of the invoice. We do NOT generate
 * a binary PDF here — the user opens the response in a new tab and uses the
 * browser's print-to-PDF (Cmd+P). This keeps the dependency footprint small
 * and avoids shipping a headless browser.
 */
export const GET = defineRoute({
  permission: "invoices:view",
  params: Params,
  async handler({ session, params }) {
    const invoice = await service.getById(
      session.factoryId,
      session.role,
      params.id,
    );
    const html = renderInvoiceHtml(invoice);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
});
