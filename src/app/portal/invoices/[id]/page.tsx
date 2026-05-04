import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import {
  INVOICE_STATUS_LABELS_AR,
  type InvoiceStatus,
} from "@/modules/invoices/invoice.schemas";
import { requireCustomerPortalSession } from "@/modules/portal/customer-session";

import { PrintButton } from "./print-button";

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

function formatQty(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerInvoiceDetailPage({ params }: PageProps) {
  const { id: invoiceId } = await params;
  const { customer, factory } = await requireCustomerPortalSession();

  const inv = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      factoryId: factory.id,
      customerId: customer.id,
      deletedAt: null,
      status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    include: { lines: true },
  });

  if (!inv) notFound();

  const due = inv.total.minus(inv.amountPaid);
  const lines = [...inv.lines].sort((a, b) => a.sortOrder - b.sortOrder);

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
            href="/portal/invoices"
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
              {inv.number}
            </h1>
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[inv.status as InvoiceStatus]}`}
            >
              {INVOICE_STATUS_LABELS_AR[inv.status as InvoiceStatus]}
            </span>
          </div>
          <div className="text-left text-sm">
            <div>
              <span className="text-[var(--muted-foreground)]">
                تاريخ الإصدار:
              </span>{" "}
              <span className="font-medium">{formatDate(inv.issueDate)}</span>
            </div>
            <div className="mt-1">
              <span className="text-[var(--muted-foreground)]">
                تاريخ الاستحقاق:
              </span>{" "}
              <span className="font-medium">{formatDate(inv.dueDate)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              من (البائع)
            </p>
            <p className="mt-2 font-semibold">
              {inv.sellerNameSnapshot ||
                factory.portalDisplayName ||
                factory.name}
            </p>
            {inv.sellerTaxNumberSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                الرقم الضريبي: {inv.sellerTaxNumberSnapshot}
              </p>
            )}
            {inv.sellerAddressSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-line">
                {inv.sellerAddressSnapshot}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              إلى (المشتري)
            </p>
            <p className="mt-2 font-semibold">
              {inv.buyerNameSnapshot || customer.name}
            </p>
            {inv.buyerTaxNumberSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                الرقم الضريبي: {inv.buyerTaxNumberSnapshot}
              </p>
            )}
            {inv.buyerAddressSnapshot && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-line">
                {inv.buyerAddressSnapshot}
              </p>
            )}
          </div>
        </div>

        <div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-right">
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                  #
                </th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                  الوصف
                </th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                  الكمية
                </th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                  سعر الوحدة
                </th>
                <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 px-2 text-center text-[var(--muted-foreground)]"
                  >
                    لا توجد بنود
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-3 px-2">{idx + 1}</td>
                    <td className="py-3 px-2">
                      {line.description}
                      {line.sku && (
                        <span className="block text-xs text-[var(--muted-foreground)]">
                          SKU: {line.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {formatQty(line.quantity.toFixed(4))}
                    </td>
                    <td className="py-3 px-2">
                      {formatMoney(line.unitPrice.toFixed(4), inv.currency)}
                    </td>
                    <td className="py-3 px-2">
                      {formatMoney(decToString(line.lineTotal), inv.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">
                المجموع الفرعي
              </span>
              <span className="font-medium">
                {formatMoney(decToString(inv.subtotal), inv.currency)}
              </span>
            </div>
            {Number(inv.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">الخصم</span>
                <span className="font-medium">
                  - {formatMoney(decToString(inv.discountAmount), inv.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">
                الضريبة ({inv.taxRate.toFixed(2)}%
                {inv.taxInclusive ? " — شاملة" : ""})
              </span>
              <span className="font-medium">
                {formatMoney(decToString(inv.taxAmount), inv.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base">
              <span className="font-semibold">الإجمالي</span>
              <span className="font-semibold">
                {formatMoney(decToString(inv.total), inv.currency)}
              </span>
            </div>
            {Number(inv.amountPaid) > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">
                    المدفوع
                  </span>
                  <span className="font-medium">
                    {formatMoney(decToString(inv.amountPaid), inv.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">المتبقي</span>
                  <span className="font-semibold">
                    {formatMoney(decToString(due), inv.currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {inv.notes && (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              ملاحظات
            </p>
            <p className="mt-2 text-sm whitespace-pre-line">{inv.notes}</p>
          </div>
        )}
      </section>
    </main>
  );
}
