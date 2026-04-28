import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import { CustomerService } from "@/modules/customers/customer.service";
import { OrderService } from "@/modules/orders/order.service";
import { EmptyState, StatusPill } from "@/components/ui";
import { formatSAR, formatDateAr } from "@/lib/format";

import { CreateOrderForm } from "./create-order-form";

const orderService = new OrderService();
const customerService = new CustomerService();

function formatCurrency(amount: number | null, currency: string) {
  if (amount == null) return "غير مسعّر";
  return formatSAR(amount, { currency });
}

function formatDate(value: string | null) {
  if (!value) return "لا يوجد هدف";
  return formatDateAr(value);
}

export default async function OrdersArchitecturePage() {
  const session = await requirePermission("orders:view");
  const [orders, customers] = await Promise.all([
    orderService.list(session.factoryId),
    customerService.list(session.factoryId),
  ]);

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          الطلبات
        </p>
        <h1 className="mt-3 text-3xl font-semibold">الطلبات الحقيقية تتدفق الآن عبر طبقة الخدمة.</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          الطلبات سجلات مُحدّدة بنطاق المصنع مدعومة بـ Prisma ومحمية بأذونات الجلسة.
          تقرأ هذه الصفحة الآن الصفوف المثبتة فعلياً وتنشئ صفوفاً جديدة من خلال نفس عقود الخدمة وواجهة برمجة التطبيقات.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-2xl font-semibold">قائمة الطلبات</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {orders.length} طلبات مثبتة في هذا المصنع
              </p>
            </div>
            <Link className="button-secondary" href="/app/customers">
              إدارة العملاء
            </Link>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              heading="لا توجد طلبات بعد"
              description="أنشئ عميلاً ثم أضف أول طلب من النموذج بجانب هذه القائمة."
              variant="compact"
            >
              <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="22" width="48" height="50" rx="6" fill="var(--accent)" fillOpacity="0.10" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="2"/>
                <path d="M30 36 L58 36 M30 46 L58 46 M30 56 L48 56" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </EmptyState>
          ) : (
            <>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-start text-sm">
                  <thead className="text-[var(--muted-foreground)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-3 pe-4 font-medium">الرمز</th>
                      <th className="px-4 py-3 font-medium">العنوان</th>
                      <th className="px-4 py-3 font-medium">العميل</th>
                      <th className="px-4 py-3 font-medium">الحالة</th>
                      <th className="px-4 py-3 font-medium">الهدف</th>
                      <th className="px-4 py-3 font-medium">السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="py-4 pe-4 font-medium">{order.code}</td>
                        <td className="px-4 py-4">
                          <Link className="font-medium hover:underline" href={`/app/orders/${order.id}`}>
                            {order.title}
                          </Link>
                        </td>
                        <td className="px-4 py-4">{order.customerName}</td>
                        <td className="px-4 py-4">
                          <StatusPill status={order.status} />
                        </td>
                        <td className="px-4 py-4">{formatDate(order.targetDate)}</td>
                        <td className="px-4 py-4">{formatCurrency(order.quotedAmount, session.factoryCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/app/orders/${order.id}`}
                    className="block rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[var(--muted-foreground)]">{order.code}</p>
                        <p className="mt-1 font-semibold">{order.title}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{order.customerName}</p>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                      <span>الهدف: {formatDate(order.targetDate)}</span>
                      <span>السعر: {formatCurrency(order.quotedAmount, session.factoryCurrency)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </article>

        <CreateOrderForm customers={customers} />
      </section>
    </main>
  );
}
