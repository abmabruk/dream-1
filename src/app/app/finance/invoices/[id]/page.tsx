import { notFound } from "next/navigation";

import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { CustomerService } from "@/modules/customers/customer.service";
import { CreditNoteService } from "@/modules/invoices/credit-note.service";
import { InvoiceService } from "@/modules/invoices/invoice.service";

import { InvoiceDetailView } from "./invoice-detail";

const invoiceService = new InvoiceService();
const creditNoteService = new CreditNoteService();
const customerService = new CustomerService();

export default async function InvoiceDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("invoices:view");
  const { id } = await params;

  const invoice = await invoiceService
    .getById(session.factoryId, session.role, id)
    .catch(() => null);
  if (!invoice) notFound();

  const [creditNotes, customers] = await Promise.all([
    creditNoteService
      .listByInvoice(session.factoryId, session.role, id)
      .catch(() => [] as Awaited<ReturnType<typeof creditNoteService.listByInvoice>>),
    customerService.list(session.factoryId),
  ]);

  const customer =
    customers.find((c: { id: string }) => c.id === invoice.customerId) ?? null;

  return (
    <InvoiceDetailView
      invoice={invoice}
      creditNotes={creditNotes}
      customer={
        customer
          ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              city: customer.city,
              district: customer.district,
            }
          : null
      }
      canManage={hasPermission(session.role, "invoices:manage")}
      canIssue={hasPermission(session.role, "invoices:issue")}
      canVoid={hasPermission(session.role, "invoices:void")}
      canCreditNote={hasPermission(session.role, "credit-notes:manage")}
      canRecordPayment={hasPermission(session.role, "payments:manage")}
    />
  );
}
