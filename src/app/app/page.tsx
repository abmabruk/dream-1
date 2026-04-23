import { requirePermission } from "@/modules/auth/guards";
import { DashboardService } from "@/modules/dashboard/dashboard.service";

const dashboardService = new DashboardService();

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function AppHomePage() {
  const session = await requirePermission("dashboard:view");
  const snapshot = await dashboardService.getSnapshot(session.factoryId);
  const setupEntries = [
    {
      label: "Environment configured",
      complete: snapshot.setup.envReady,
    },
    {
      label: "Customers added",
      complete: snapshot.setup.hasCustomers,
    },
    {
      label: "Orders created",
      complete: snapshot.setup.hasOrders,
    },
    {
      label: "More than one active user",
      complete: snapshot.setup.hasMultipleUsers,
    },
  ];

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Dashboard
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Live factory snapshot
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          This page now reads actual database records for the signed-in factory.
          No mock counters or canned activity are used here.
        </p>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-5 py-4">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Current session
          </p>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <p><span className="text-[var(--muted-foreground)]">Name:</span> {session.displayName}</p>
            <p><span className="text-[var(--muted-foreground)]">Email:</span> {session.email}</p>
            <p><span className="text-[var(--muted-foreground)]">Role:</span> {session.role}</p>
            <p><span className="text-[var(--muted-foreground)]">Factory:</span> {session.factoryName}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            label: "Customers",
            value: snapshot.stats.totalCustomers.toString(),
          },
          {
            label: "Orders",
            value: snapshot.stats.totalOrders.toString(),
          },
          {
            label: "Active orders",
            value: snapshot.stats.activeOrders.toString(),
          },
          {
            label: "Delivered orders",
            value: snapshot.stats.deliveredOrders.toString(),
          },
          {
            label: "Quoted revenue",
            value: formatCurrency(snapshot.stats.quotedRevenue, session.factoryCurrency),
          },
          {
            label: "Active users",
            value: snapshot.stats.activeUsers.toString(),
          },
        ].map((item) => (
          <article key={item.label} className="panel">
            <p className="text-sm text-[var(--muted-foreground)]">{item.label}</p>
            <h2 className="mt-2 text-3xl font-semibold">{item.value}</h2>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr_0.95fr]">
        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Setup health
          </p>
          <div className="mt-5 space-y-3">
            {setupEntries.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3"
              >
                <span className="text-sm">{entry.label}</span>
                <span
                  className={
                    entry.complete
                      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                      : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
                  }
                >
                  {entry.complete ? "Ready" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Recent orders
          </p>
          <div className="mt-5 space-y-3">
            {snapshot.recentOrders.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No orders yet.
              </p>
            ) : (
              snapshot.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{order.code}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {order.title}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-sm text-[var(--muted-foreground)]">
                    <span>{order.customerName}</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Recent customers
          </p>
          <div className="mt-5 space-y-3">
            {snapshot.recentCustomers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No customers yet.
              </p>
            ) : (
              snapshot.recentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{customer.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {customer.phone ?? "No phone"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {customer.orderCount} orders
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    Added on {formatDate(customer.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
