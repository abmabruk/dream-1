import Link from "next/link";

import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import {
  INVOICE_STATUS_LABELS_AR,
  type InvoiceStatus,
} from "@/modules/invoices/invoice.schemas";
import { requireCustomerPortalSession } from "@/modules/portal/customer-session";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-slate-200 text-slate-500",
};

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatMoney(value: string, currency: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return currency === "SAR" ? `${formatted} ر.س` : `${formatted} ${currency}`;
}

export default async function CustomerInvoicesPage() {
  const { customer, factory } = await requireCustomerPortalSession();

  const invoices = await db.invoice.findMany({
    where: {
      factoryId: factory.id,
      customerId: customer.id,
      deletedAt: null,
      status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    orderBy: [{ issueDate: "desc" }, { numberSeq: "desc" }],
    select: {
      id: true,
      number: true,
      status: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      total: true,
      amountPaid: true,
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {factory.portalDisplayName || factory.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              فواتيرك
            </h1>
            <p className="mt-2 text-base text-[var(--muted-foreground)]">
              جميع الفواتير المنظورة عبر طلباتك.
            </p>
          </div>
          <Link
            href="/portal/dashboard"
            className="text-sm text-[var(--muted-foreground)] hover:underline"
          >
            ← لوحة التحكم
          </Link>
        </div>
      </section>

      <section className="panel">
        {invoices.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)] py-12">
            لا يوجد فواتير منظورة بعد.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right">
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    رقم الفاتورة
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    تاريخ الإصدار
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    تاريخ الاستحقاق
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    الإجمالي
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    المتبقي
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    الحالة
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const due = inv.total.minus(inv.amountPaid);
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="py-3 px-2 font-mono">{inv.number}</td>
                      <td className="py-3 px-2">{formatDate(inv.issueDate)}</td>
                      <td className="py-3 px-2">{formatDate(inv.dueDate)}</td>
                      <td className="py-3 px-2">
                        {formatMoney(decToString(inv.total), inv.currency)}
                      </td>
                      <td className="py-3 px-2">
                        {formatMoney(decToString(due), inv.currency)}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[inv.status as InvoiceStatus]}`}
                        >
                          {
                            INVOICE_STATUS_LABELS_AR[
                              inv.status as InvoiceStatus
                            ]
                          }
                        </span>
                      </td>
                      <td className="py-3 px-2 text-left">
                        <Link
                          href={`/portal/invoices/${inv.id}`}
                          className="text-sm font-semibold text-[var(--accent)] hover:underline"
                        >
                          عرض ←
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
