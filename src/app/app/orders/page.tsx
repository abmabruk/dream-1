import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import { CustomerService } from "@/modules/customers/customer.service";
import { OrderService } from "@/modules/orders/order.service";

import { CreateOrderForm } from "./create-order-form";

const orderService = new OrderService();
const customerService = new CustomerService();

function formatCurrency(amount: number | null, currency: string) {
  if (amount == null) {
    return "Not quoted";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No target";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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
          Orders module
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Real orders are now flowing through the service layer.</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          Orders are factory-scoped records backed by Prisma and protected by session permissions.
          This page now reads actual persisted rows and creates new ones through the same service and API contracts.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-2xl font-semibold">Order list</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {orders.length} persisted orders in this factory
              </p>
            </div>
            <Link className="button-secondary" href="/app/customers">
              Manage customers
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="py-10 text-sm text-[var(--muted-foreground)]">
              No orders yet. Create the first customer and first order from the forms in this workspace.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[var(--muted-foreground)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pr-4 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">Quoted</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-4 pr-4 font-medium">{order.code}</td>
                      <td className="px-4 py-4">
                        <Link className="font-medium hover:underline" href={`/app/orders/${order.id}`}>
                          {order.title}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{order.customerName}</td>
                      <td className="px-4 py-4">{order.status}</td>
                      <td className="px-4 py-4">{formatDate(order.targetDate)}</td>
                      <td className="px-4 py-4">{formatCurrency(order.quotedAmount, session.factoryCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <CreateOrderForm customers={customers} />
      </section>
    </main>
  );
}
