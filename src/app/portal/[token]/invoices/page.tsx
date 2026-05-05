import Link from "next/link";
import { notFound } from "next/navigation";

import {
  INVOICE_STATUS_LABELS_AR,
  type InvoiceStatus,
} from "@/modules/invoices/invoice.schemas";
import { PortalService } from "@/modules/portal/portal.service";

const portalService = new PortalService();

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-slate-200 text-slate-500",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PortalInvoicesPage({ params }: PageProps) {
  const { token } = await params;

  let detail: Awaited<ReturnType<PortalService["getInvoicesForToken"]>>;
  try {
    detail = await portalService.getInvoicesForToken(token);
  } catch {
    notFound();
  }

  if (!detail) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {detail.factory.portalDisplayName || detail.factory.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              فواتير الطلب {detail.order.code}
            </h1>
            <p className="mt-2 text-base text-[var(--muted-foreground)]">
              {detail.order.title}
            </p>
          </div>
          <Link
            href={`/portal/${token}`}
            className="text-sm text-[var(--muted-foreground)] hover:underline"
          >
            ← العودة للطلب
          </Link>
        </div>
      </section>

      <section className="panel">
        {detail.invoices.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)] py-12">
            لا يوجد فواتير لهذا الطلب بعد
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right">
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">رقم الفاتورة</th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">تاريخ الإصدار</th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">تاريخ الاستحقاق</th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">الإجمالي</th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">المتبقي</th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">الحالة</th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]"></th>
                </tr>
              </thead>
              <tbody>
                {detail.invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-3 px-2 font-medium">{inv.number}</td>
                    <td className="py-3 px-2">{formatDate(inv.issueDate)}</td>
                    <td className="py-3 px-2">{formatDate(inv.dueDate)}</td>
                    <td className="py-3 px-2">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="py-3 px-2">{formatMoney(inv.amountDue, inv.currency)}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[inv.status]}`}
                      >
                        {INVOICE_STATUS_LABELS_AR[inv.status]}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <Link
                        href={`/portal/${token}/invoices/${inv.id}`}
                        className="text-sm font-semibold text-[var(--accent)] hover:underline"
                      >
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
