import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { CustomerService } from "@/modules/customers/customer.service";
import {
  INVOICE_STATUS_VALUES,
  type InvoiceStatus,
} from "@/modules/invoices/invoice.schemas";
import { InvoiceService } from "@/modules/invoices/invoice.service";

import { InvoicesPage } from "./invoices-page";

const invoiceService = new InvoiceService();
const customerService = new CustomerService();

export default async function InvoicesRoute({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const session = await requirePermission("invoices:view");
  const canManage = hasPermission(session.role, "invoices:manage");
  const sp = await searchParams;

  const status: InvoiceStatus | undefined =
    sp.status && (INVOICE_STATUS_VALUES as readonly string[]).includes(sp.status)
      ? (sp.status as InvoiceStatus)
      : undefined;

  const [invoices, customers] = await Promise.all([
    invoiceService.list(session.factoryId, session.role, {
      customerId: sp.customerId,
      status,
    }),
    customerService.list(session.factoryId),
  ]);

  return (
    <InvoicesPage
      invoices={invoices}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canManage={canManage}
      defaultStatus={sp.status ?? ""}
      defaultQuery={sp.q ?? ""}
      defaultCustomerId={sp.customerId ?? ""}
    />
  );
}
