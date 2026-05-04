import Link from "next/link";

import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order-status";
import { customerSignOutAction } from "@/app/portal/actions";
import { requireCustomerPortalSession } from "@/modules/portal/customer-session";

export const dynamic = "force-dynamic";

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

export default async function CustomerDashboardPage() {
  const { customer, factory } = await requireCustomerPortalSession();

  // Their orders
  const orders = await db.order.findMany({
    where: { factoryId: factory.id, customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      targetDate: true,
      quotedAmount: true,
      createdAt: true,
    },
    take: 50,
  });

  // Recent visible invoices
  const invoices = await db.invoice.findMany({
    where: {
      factoryId: factory.id,
      customerId: customer.id,
      deletedAt: null,
      status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    orderBy: [{ issueDate: "desc" }, { numberSeq: "desc" }],
    take: 5,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
      issueDate: true,
      dueDate: true,
    },
  });

  // Outstanding total across all visible invoices (not just top 5)
  const allOpen = await db.invoice.findMany({
    where: {
      factoryId: factory.id,
      customerId: customer.id,
      deletedAt: null,
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: { total: true, amountPaid: true, currency: true },
  });
  const outstanding = allOpen.reduce((sum, inv) => {
    return sum + Number(inv.total.minus(inv.amountPaid));
  }, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {factory.portalDisplayName || factory.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              مرحباً، {customer.name}
            </h1>
            <p className="mt-2 text-base text-[var(--muted-foreground)]">
              هذه نظرة شاملة على طلباتك وفواتيرك.
            </p>
          </div>
          <form action={customerSignOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--panel-strong)]"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">عدد الطلبات</p>
          <h2 className="mt-2 text-2xl font-semibold">{orders.length}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">
            فواتير منظورة
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {invoices.length === 0
              ? 0
              : allOpen.length +
                invoices.filter((i) => i.status === "PAID").length}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            (مرسلة / مدفوعة جزئياً / مدفوعة / متأخرة)
          </p>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">
            المبلغ المتبقي
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {formatMoney(outstanding.toFixed(2), factory.currency)}
          </h2>
        </article>
      </section>

      <section className="panel">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">طلباتك</h2>
        </div>
        {orders.length === 0 ? (
          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)] py-6">
            لا توجد طلبات بعد.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right">
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    الرمز
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    العنوان
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    الحالة
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    تاريخ الهدف
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]">
                    المبلغ المسعّر
                  </th>
                  <th className="py-3 px-2 font-semibold text-[var(--muted-foreground)]"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-3 px-2 font-mono">{o.code}</td>
                    <td className="py-3 px-2">{o.title}</td>
                    <td className="py-3 px-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="py-3 px-2">{formatDate(o.targetDate)}</td>
                    <td className="py-3 px-2">
                      {o.quotedAmount
                        ? formatMoney(
                            decToString(o.quotedAmount),
                            factory.currency,
                          )
                        : "—"}
                    </td>
                    <td className="py-3 px-2 text-left">
                      <Link
                        className="text-sm font-semibold text-[var(--accent)] hover:underline"
                        href={`/portal/orders/${o.id}`}
                      >
                        تفاصيل ←
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">آخر الفواتير</h2>
          <Link
            href="/portal/invoices"
            className="text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            عرض كل الفواتير ←
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)] py-6">
            لا توجد فواتير بعد.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {invoices.map((inv) => {
              const due = inv.total.minus(inv.amountPaid);
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <Link
                      href={`/portal/invoices/${inv.id}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {inv.number}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      أُصدرت في {formatDate(inv.issueDate)}
                    </p>
                  </div>
                  <div className="text-left text-sm">
                    <p className="font-semibold">
                      {formatMoney(decToString(inv.total), inv.currency)}
                    </p>
                    {Number(due) > 0 && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        المتبقي: {formatMoney(decToString(due), inv.currency)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
