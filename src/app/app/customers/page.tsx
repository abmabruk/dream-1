import { requirePermission } from "@/modules/auth/guards";
import { CustomerService } from "@/modules/customers/customer.service";
import { EmptyState } from "@/components/ui";

import { CreateCustomerForm } from "./create-customer-form";

const customerService = new CustomerService();

export default async function CustomersPage() {
  const session = await requirePermission("customers:view");
  const customers = await customerService.list(session.factoryId);

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          العملاء
        </p>
        <h1 className="mt-3 text-3xl font-semibold">سجلات عملاء المصنع</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          العملاء الآن سجلات حقيقية مثبتة مُحدّدة بنطاق المصنع المسجل دخوله. لا
          يمكن إنشاء الطلبات إلا مقابل العملاء المنتمين إلى نفس المساحة.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-2xl font-semibold">قائمة العملاء</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {customers.length} عملاء في هذا المصنع
              </p>
            </div>
          </div>

          {customers.length === 0 ? (
            <EmptyState
              heading="لا يوجد عملاء بعد"
              description="أضف أول عميل من النموذج بجانب هذه القائمة لتبدأ ربط الطلبات."
              variant="compact"
            >
              <svg
                width="88"
                height="88"
                viewBox="0 0 88 88"
                fill="none"
                aria-hidden
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="44"
                  cy="32"
                  r="14"
                  fill="var(--accent)"
                  fillOpacity="0.14"
                />
                <circle
                  cx="44"
                  cy="32"
                  r="9"
                  stroke="var(--accent)"
                  strokeOpacity="0.7"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M18 72c0-13 12-22 26-22s26 9 26 22"
                  stroke="var(--accent)"
                  strokeOpacity="0.7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </EmptyState>
          ) : (
            <>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-start text-sm">
                  <thead className="text-[var(--muted-foreground)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-3 pe-4 font-medium">الاسم</th>
                      <th className="px-4 py-3 font-medium">الهاتف</th>
                      <th className="px-4 py-3 font-medium">الموقع</th>
                      <th className="px-4 py-3 font-medium">الطلبات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="py-4 pe-4">
                          <p className="font-medium">{customer.name}</p>
                          <p className="mt-1 text-[var(--muted-foreground)]">
                            {customer.email ?? "لا يوجد بريد إلكتروني"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {customer.phone ?? "لا يوجد هاتف"}
                        </td>
                        <td className="px-4 py-4">
                          {[customer.city, customer.district]
                            .filter(Boolean)
                            .join(", ") || "لا يوجد موقع"}
                        </td>
                        <td className="px-4 py-4 tabular-nums">
                          {customer.orderCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {customers.map((customer) => (
                  <article
                    key={customer.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4"
                  >
                    <p className="font-semibold">{customer.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {customer.email ?? "لا يوجد بريد إلكتروني"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                      <span>الهاتف: {customer.phone ?? "—"}</span>
                      <span>
                        الموقع:{" "}
                        {[customer.city, customer.district]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </span>
                      <span>الطلبات: {customer.orderCount}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </article>

        <CreateCustomerForm />
      </section>
    </main>
  );
}
