import Link from "next/link";
import { notFound } from "next/navigation";

import {
  INVOICE_STATUS_LABELS_AR,
  type InvoiceStatus,
} from "@/modules/invoices/invoice.schemas";
import { PortalService } from "@/modules/portal/portal.service";

import { PrintButton } from "./print-button";

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

function formatQty(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
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
  params: Promise<{ token: string; invoiceId: string }>;
};

export default async function PortalInvoiceDetailPage({ params }: PageProps) {
  const { token, invoiceId } = await params;

  let detail: Awaited<ReturnType<PortalService["getInvoiceForToken"]>>;
  try {
    detail = await portalService.getInvoiceForToken(token, invoiceId);
  } catch {
    notFound();
  }

  if (!detail) notFound();

  const { invoice, factory } = detail;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .panel { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      <section className="panel no-print">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/portal/${token}/invoices`}
            className="text-sm text-[var(--muted-foreground)] hover:underline"
          >
            ← العودة للفواتير
          </Link>
          <PrintButton />
        </div>
      </section>

      <section className="panel space-y-6">
        <div className="flex items-start justify-between gap-6 border-b border-[var(--border)] pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              فاتورة
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {invoice.number}
            </h1>
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[invoice.status]}`}
            >
              {INVOICE_STATUS_LABELS_AR[invoice.status]}
            </span>
          </div>
          <div className="text-left text-sm">
            <div>
              <span className="text-[var(--muted-foreground)]">تاريخ الإصدار:</span>{" "}
              <span className="font-medium">{formatDate(invoice.issueDate)}</span>
            </div>
            <div className="mt-1">
              <span className="text-[var(--muted-foreground)]">تاريخ الاستحقاق:</span>{" "}
              <span className="font-medium">{formatDate(invoice.dueDate)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              من (البائع)
            </p>
            <p className="mt-2 font-semibold">
              {invoice.sellerNameSnapshot || factory.portalDisplayName || factory.name}
            </p>
            {invoice.sellerTaxNumberSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                الرقم الضريبي: {invoice.sellerTaxNumberSnapshot}
              </p>
            )}
            {invoice.sellerAddressSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-line">
                {invoice.sellerAddressSnapshot}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              إلى (المشتري)
            </p>
            <p className="mt-2 font-semibold">
              {invoice.buyerNameSnapshot || "—"}
            </p>
            {invoice.buyerTaxNumberSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                الرقم الضريبي: {invoice.buyerTaxNumberSnapshot}
              </p>
            )}
            {invoice.buyerAddressSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-line">
                {invoice.buyerAddressSnapshot}
              </p>
            )}
          </div>
        </div>

        <div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-right">
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">#</th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">الوصف</th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">الكمية</th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">سعر الوحدة</th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 px-2 text-center text-[var(--muted-foreground)]">
                    لا توجد بنود
                  </td>
                </tr>
              ) : (
                invoice.lines.map((line, idx) => (
                  <tr key={line.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 px-2">{idx + 1}</td>
                    <td className="py-3 px-2">
                      {line.description}
                      {line.sku && (
                        <span className="block text-xs text-[var(--muted-foreground)]">
                          SKU: {line.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">{formatQty(line.quantity)}</td>
                    <td className="py-3 px-2">{formatMoney(line.unitPrice, invoice.currency)}</td>
                    <td className="py-3 px-2">{formatMoney(line.lineTotal, invoice.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">المجموع الفرعي</span>
              <span className="font-medium">{formatMoney(invoice.subtotal, invoice.currency)}</span>
            </div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">الخصم</span>
                <span className="font-medium">- {formatMoney(invoice.discountAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">
                الضريبة ({invoice.taxRate}%{invoice.taxInclusive ? " — شاملة" : ""})
              </span>
              <span className="font-medium">{formatMoney(invoice.taxAmount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base">
              <span className="font-semibold">الإجمالي</span>
              <span className="font-semibold">{formatMoney(invoice.total, invoice.currency)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">المدفوع</span>
                  <span className="font-medium">{formatMoney(invoice.amountPaid, invoice.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">المتبقي</span>
                  <span className="font-semibold">{formatMoney(invoice.amountDue, invoice.currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              ملاحظات
            </p>
            <p className="mt-2 text-sm whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </section>
    </main>
  );
}
