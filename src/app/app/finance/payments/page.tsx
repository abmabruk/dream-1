import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { CustomerService } from "@/modules/customers/customer.service";
import { InvoiceService } from "@/modules/invoices/invoice.service";
import {
  PAYMENT_KIND_VALUES,
  type PaymentKind,
} from "@/modules/payments/payment.schemas";
import { PaymentService } from "@/modules/payments/payment.service";

import { PaymentsPage } from "./payments-page";

const paymentService = new PaymentService();
const customerService = new CustomerService();
const invoiceService = new InvoiceService();

export default async function PaymentsRoute({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    kind?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  const session = await requirePermission("payments:view");
  const canManage = hasPermission(session.role, "payments:manage");
  const sp = await searchParams;

  const kind: PaymentKind | undefined =
    sp.kind && (PAYMENT_KIND_VALUES as readonly string[]).includes(sp.kind)
      ? (sp.kind as PaymentKind)
      : undefined;

  const [payments, customers, invoices] = await Promise.all([
    paymentService.list(session.factoryId, session.role, {
      customerId: sp.customerId,
      kind,
      from: sp.from,
      to: sp.to,
    }),
    customerService.list(session.factoryId),
    invoiceService.list(session.factoryId, session.role, {}),
  ]);

  return (
    <PaymentsPage
      payments={payments}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      openInvoices={invoices
        .filter(
          (i) =>
            i.status === "SENT" ||
            i.status === "PARTIALLY_PAID" ||
            i.status === "OVERDUE",
        )
        .map((i) => ({
          id: i.id,
          number: i.number,
          customerId: i.customerId,
          total: i.total,
          amountPaid: i.amountPaid,
          amountDue: i.amountDue,
        }))}
      canManage={canManage}
      defaultKind={sp.kind ?? ""}
      defaultFrom={sp.from ?? ""}
      defaultTo={sp.to ?? ""}
      defaultCustomerId={sp.customerId ?? ""}
      defaultQuery={sp.q ?? ""}
    />
  );
}
