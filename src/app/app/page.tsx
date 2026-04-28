import { requirePermission } from "@/modules/auth/guards";
import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { MetricCard, StatusPill } from "@/components/ui";
import {
  arabicGreeting,
  formatDateAr,
  formatNumber,
  formatRelativeTime,
  formatSAR,
} from "@/lib/format";

const dashboardService = new DashboardService();

export default async function AppHomePage() {
  const session = await requirePermission("dashboard:view");
  const snapshot = await dashboardService.getSnapshot(session.factoryId);

  const setupEntries = [
    { label: "البيئة مُهيأة", complete: snapshot.setup.envReady },
    { label: "العملاء مضافون", complete: snapshot.setup.hasCustomers },
    { label: "الطلبات منشأة", complete: snapshot.setup.hasOrders },
    { label: "أكثر من مستخدم نشط", complete: snapshot.setup.hasMultipleUsers },
  ];

  const greeting = arabicGreeting();
  const ownerFirstName = session.displayName.split(" ")[0] || session.displayName;

  return (
    <main className="space-y-6">
      {/* ── Greeting + hero metric ───────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr] xl:grid-cols-[1.6fr_1fr]">
        <article className="panel flex flex-col justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              لقطة المصنع المباشرة
            </p>
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              مرحباً، {ownerFirstName} · {greeting}
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base leading-7 md:leading-8 text-[var(--muted-foreground)]">
              {session.factoryName} · {session.role}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              size="hero"
              label="الطلبات النشطة"
              tone="accent"
              value={formatNumber(snapshot.stats.activeOrders)}
              sublabel="قيد التنفيذ الآن"
              trend="up"
            />
            <MetricCard
              size="hero"
              label="الإيرادات المسعّرة"
              tone="default"
              value={formatSAR(snapshot.stats.quotedRevenue, { currency: session.factoryCurrency, decimals: 0 })}
              sublabel="عبر جميع الطلبات"
            />
          </div>
        </article>

        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            صحة الإعداد
          </p>
          <div className="mt-5 space-y-2.5">
            {setupEntries.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3"
              >
                <span className="text-sm">{entry.label}</span>
                <StatusPill
                  status={entry.complete ? "DONE" : "WAITING"}
                  label={entry.complete ? "جاهز" : "معلّق"}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Secondary metrics row ───────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="العملاء"
          value={formatNumber(snapshot.stats.totalCustomers)}
          sublabel="إجمالي السجلات"
        />
        <MetricCard
          label="الطلبات"
          value={formatNumber(snapshot.stats.totalOrders)}
          sublabel={`${formatNumber(snapshot.stats.deliveredOrders)} تم التسليم`}
        />
        <MetricCard
          label="المسلّمة"
          value={formatNumber(snapshot.stats.deliveredOrders)}
          tone="accent"
          sublabel="مكتملة"
        />
        <MetricCard
          label="المستخدمون النشطون"
          value={formatNumber(snapshot.stats.activeUsers)}
          sublabel="يصلون الآن"
        />
      </section>

      {/* ── Tertiary strip — quick session counts ───────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard size="compact" label="الاسم" value={session.displayName} tone="muted" />
        <MetricCard size="compact" label="البريد" value={session.email} tone="muted" />
        <MetricCard size="compact" label="الدور" value={session.role} tone="muted" />
        <MetricCard size="compact" label="المصنع" value={session.factoryName} tone="muted" />
      </section>

      {/* ── Latest activity row ─────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            أحدث الطلبات
          </p>
          <div className="mt-5 space-y-3">
            {snapshot.recentOrders.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                لا توجد طلبات بعد.
              </p>
            ) : (
              snapshot.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{order.code}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)] truncate">
                        {order.title}
                      </p>
                    </div>
                    <StatusPill status={order.status} size="sm" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)]">
                    <span>{order.customerName}</span>
                    <span title={formatDateAr(order.createdAt)}>
                      {formatRelativeTime(order.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            أحدث العملاء
          </p>
          <div className="mt-5 space-y-3">
            {snapshot.recentCustomers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                لا يوجد عملاء بعد.
              </p>
            ) : (
              snapshot.recentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{customer.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {customer.phone ?? "لا يوجد هاتف"}
                      </p>
                    </div>
                    <StatusPill
                      status="PLANNED"
                      label={`${formatNumber(customer.orderCount)} طلبات`}
                      size="sm"
                    />
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                    أُضيف {formatRelativeTime(customer.createdAt)}
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
