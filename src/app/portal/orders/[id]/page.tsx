import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import {
  INVOICE_STATUS_LABELS_AR,
  type InvoiceStatus,
} from "@/modules/invoices/invoice.schemas";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order-status";
import { requireCustomerPortalSession } from "@/modules/portal/customer-session";

export const dynamic = "force-dynamic";

const ORDER_EVENT_LABELS_AR: Record<string, string> = {
  CREATED: "إنشاء الطلب",
  STATUS_CHANGED: "تغيير الحالة",
  ASSIGNMENT_CREATED: "إسناد عامل",
  ASSIGNMENT_STATUS_CHANGED: "تغيير حالة الإسناد",
  PORTAL_SHARED: "مشاركة رابط البوابة",
  PORTAL_APPROVED: "موافقة العميل",
};

const VISIBLE_EVENT_TYPES = new Set([
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNMENT_STATUS_CHANGED",
  "PORTAL_SHARED",
  "PORTAL_APPROVED",
]);

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

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerOrderDetailPage({ params }: PageProps) {
  const { id: orderId } = await params;
  const { customer, factory } = await requireCustomerPortalSession();

  const order = await db.order.findFirst({
    where: {
      id: orderId,
      factoryId: factory.id,
      customerId: customer.id,
    },
    include: {
      assignments: {
        select: {
          id: true,
          station: true,
          status: true,
          scheduledFor: true,
        },
        orderBy: { createdAt: "asc" },
      },
      events: {
        select: {
          id: true,
          type: true,
          toStatus: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!order) notFound();

  // Visible invoices for this order
  const invoices = await db.invoice.findMany({
    where: {
      factoryId: factory.id,
      customerId: customer.id,
      orderId: order.id,
      deletedAt: null,
      status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    orderBy: [{ issueDate: "desc" }],
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
      issueDate: true,
    },
  });

  const visibleEvents = order.events.filter((e) =>
    VISIBLE_EVENT_TYPES.has(e.type),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {factory.portalDisplayName || factory.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {order.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              رمز الطلب: <span className="font-mono">{order.code}</span>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">
            الحالة الحالية
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {ORDER_STATUS_LABELS[order.status]}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">تاريخ الهدف</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {formatDate(order.targetDate)}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">
            المبلغ المسعّر
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {order.quotedAmount
              ? formatMoney(decToString(order.quotedAmount), factory.currency)
              : "—"}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">
            تاريخ التسليم
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {formatDate(order.deliveredAt)}
          </h2>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          {invoices.length > 0 && (
            <article className="panel">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                الفواتير
              </p>
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {invoices.map((inv) => {
                  const due = inv.total.minus(inv.amountPaid);
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <Link
                          href={`/portal/invoices/${inv.id}`}
                          className="font-mono font-semibold hover:underline"
                        >
                          {inv.number}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {
                            INVOICE_STATUS_LABELS_AR[
                              inv.status as InvoiceStatus
                            ]
                          }{" "}
                          · {formatDate(inv.issueDate)}
                        </p>
                      </div>
                      <div className="text-left text-sm">
                        <p className="font-semibold">
                          {formatMoney(decToString(inv.total), inv.currency)}
                        </p>
                        {Number(due) > 0 && (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            المتبقي:{" "}
                            {formatMoney(decToString(due), inv.currency)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          )}
        </div>

        <div className="space-y-6">
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              رؤية التسليم
            </p>
            <div className="mt-5 space-y-3">
              {order.assignments.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  لم يُجدوَل أي نشاط إنتاج بعد.
                </p>
              ) : (
                order.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{a.station}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          المجدول: {formatDate(a.scheduledFor)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {a.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              الجدول الزمني
            </p>
            <div className="mt-5 space-y-3">
              {visibleEvents.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  لا توجد تحديثات للجدول الزمني بعد.
                </p>
              ) : (
                visibleEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {ORDER_EVENT_LABELS_AR[event.type] ??
                            event.type.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                      {event.toStatus && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {ORDER_STATUS_LABELS[event.toStatus]}
                        </span>
                      )}
                    </div>
                    {event.note && (
                      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                        {event.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
