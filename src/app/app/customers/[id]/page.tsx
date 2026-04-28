import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState, MetricCard, StatusPill } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateAr, formatSAR } from "@/lib/format";
import { requirePermission } from "@/modules/auth/guards";

type OrderRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  quotedAmount: number;
  createdAt: string;
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("orders:view");
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, factoryId: session.factoryId },
    include: {
      orders: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          quotedAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const orders: OrderRow[] = customer.orders.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    status: o.status,
    quotedAmount: o.quotedAmount ? Number(o.quotedAmount) : 0,
    createdAt: o.createdAt.toISOString(),
  }));

  const totalQuoted = orders.reduce((sum, o) => sum + o.quotedAmount, 0);
  const location = [customer.city, customer.district].filter(Boolean).join("، ");

  return (
    <main className="space-y-6" dir="rtl">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          عميل
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{customer.name}</h1>
        <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">
              البريد الإلكتروني
            </dt>
            <dd className="mt-1 font-medium">
              {customer.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">الهاتف</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {customer.phone ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">المدينة</dt>
            <dd className="mt-1 font-medium">{customer.city ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">الحي</dt>
            <dd className="mt-1 font-medium">{customer.district ?? "—"}</dd>
          </div>
          {location ? (
            <div className="md:col-span-2 xl:col-span-4">
              <dt className="text-xs text-[var(--muted-foreground)]">الموقع</dt>
              <dd className="mt-1 font-medium">{location}</dd>
            </div>
          ) : null}
          {customer.notes ? (
            <div className="md:col-span-2 xl:col-span-4">
              <dt className="text-xs text-[var(--muted-foreground)]">
                ملاحظات
              </dt>
              <dd className="mt-1 whitespace-pre-line leading-7">
                {customer.notes}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label="إجمالي الطلبات"
          value={String(orders.length)}
          tone="default"
        />
        <MetricCard
          label="إجمالي المعروض"
          value={formatSAR(totalQuoted)}
          tone="accent"
        />
      </section>

      <section className="panel">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-2xl font-semibold">طلبات العميل</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {orders.length === 0
                ? "لا توجد طلبات بعد"
                : `${orders.length} طلب لهذا العميل`}
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              heading="لا توجد طلبات لهذا العميل"
              description="أنشئ طلبًا جديدًا من شاشة الطلبات لربطه بهذا العميل."
              variant="compact"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="text-[var(--muted-foreground)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-3 pe-4 font-medium">الكود</th>
                  <th className="px-4 py-3 font-medium">العنوان</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">المبلغ المعروض</th>
                  <th className="px-4 py-3 font-medium">أُنشئ في</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="py-4 pe-4 font-mono text-xs">
                      <Link
                        href={`/app/orders/${order.id}`}
                        className="hover:underline"
                      >
                        {order.code}
                      </Link>
                    </td>
                    <td className="px-4 py-4">{order.title}</td>
                    <td className="px-4 py-4">
                      <StatusPill status={order.status} size="sm" />
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {order.quotedAmount > 0
                        ? formatSAR(order.quotedAmount)
                        : "—"}
                    </td>
                    <td className="px-4 py-4 tabular-nums text-[var(--muted-foreground)]">
                      {formatDateAr(order.createdAt)}
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
