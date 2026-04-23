import Link from "next/link";

import { hasPermission } from "@/modules/auth/roles";
import { requirePermission } from "@/modules/auth/guards";
import {
  INQUIRY_STAGE_LABELS,
  INQUIRY_STAGE_VALUES,
  type InquiryStage,
} from "@/modules/crm/inquiry-stage";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_VALUES,
  type OrderWorkflowStatus,
} from "@/modules/orders/order-status";
import {
  createReportSearchParams,
} from "@/modules/reporting/reporting.schemas";
import { ReportingService } from "@/modules/reporting/reporting.service";

const reportingService = new ReportingService();

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

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
  }).format(new Date(`${value}-01T00:00:00.000Z`));
}

function getMaxValue(values: number[]) {
  return Math.max(1, ...values);
}

function getSelectedOrAll<T extends string>(selected: T[], all: readonly T[]) {
  return selected.length > 0 ? selected : [...all];
}

function buildReportHref(input: {
  from: string;
  to: string;
  orderStatuses: OrderWorkflowStatus[];
  inquiryStages: InquiryStage[];
}) {
  return `/app/reports?${createReportSearchParams(input)}`;
}

function buildExportHref(input: {
  from: string;
  to: string;
  orderStatuses: OrderWorkflowStatus[];
  inquiryStages: InquiryStage[];
}) {
  return `/api/v1/reports/export?${createReportSearchParams(input)}`;
}

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
    orderStatus?: string | string[];
    inquiryStage?: string | string[];
  }>;
};

type SummaryCard = {
  label: string;
  value: string;
  show: boolean;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await requirePermission("reports:view");
  const resolvedSearchParams = await searchParams;
  const overview = await reportingService.getOverview(
    session.factoryId,
    resolvedSearchParams
  );
  const canViewCrm = hasPermission(session.role, "crm:view");
  const canViewOrders = hasPermission(session.role, "orders:view");
  const canViewProduction = hasPermission(session.role, "production:view");
  const activeOrderStatuses = getSelectedOrAll(
    overview.filters.orderStatuses,
    ORDER_STATUS_VALUES
  );
  const activeInquiryStages = getSelectedOrAll(
    overview.filters.inquiryStages,
    INQUIRY_STAGE_VALUES
  );
  const hasAdvancedFilters =
    overview.filters.orderStatuses.length > 0 ||
    overview.filters.inquiryStages.length > 0;
  const today = new Date();
  const lastWeekStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 6);
  const lastMonthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  lastMonthStart.setUTCDate(lastMonthStart.getUTCDate() - 29);
  const lastQuarterStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  lastQuarterStart.setUTCDate(lastQuarterStart.getUTCDate() - 89);
  const maxOrderStatus = getMaxValue(
    overview.currentPipeline.orderStatuses.map((entry) => entry.count)
  );
  const maxInquiryStage = getMaxValue(
    overview.currentPipeline.inquiryStages.map((entry) => entry.count)
  );
  const summaryCards: SummaryCard[] = [
    {
      label: "Orders created",
      value: overview.summary.ordersCreated.toString(),
      show: canViewOrders,
    },
    {
      label: "Orders approved",
      value: overview.summary.ordersApproved.toString(),
      show: canViewOrders,
    },
    {
      label: "Orders delivered",
      value: overview.summary.ordersDelivered.toString(),
      show: canViewOrders,
    },
    {
      label: "New customers",
      value: overview.summary.newCustomers.toString(),
      show: canViewOrders,
    },
    {
      label: "New inquiries",
      value: overview.summary.newInquiries.toString(),
      show: canViewCrm,
    },
    {
      label: "Quoted revenue",
      value: formatCurrency(overview.summary.quotedRevenue, session.factoryCurrency),
      show: canViewOrders,
    },
    {
      label: "Delivered revenue",
      value: formatCurrency(overview.summary.deliveredRevenue, session.factoryCurrency),
      show: canViewOrders,
    },
    {
      label: "Assignments completed",
      value: overview.summary.completedAssignments.toString(),
      show: canViewProduction,
    },
    {
      label: "Overdue orders",
      value: overview.summary.overdueOrders.toString(),
      show: canViewOrders,
    },
    {
      label: "Due follow-ups",
      value: overview.summary.dueFollowUps.toString(),
      show: canViewCrm,
    },
  ];
  const activeQuery = {
    from: overview.range.from,
    to: overview.range.to,
    orderStatuses: overview.filters.orderStatuses,
    inquiryStages: overview.filters.inquiryStages,
  };

  return (
    <main className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Reporting
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Live reporting and exports
            </h1>
            <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
              This page now supports filtered reporting, exportable CSV output,
              and monthly trend summaries from the real database for the signed-in
              factory.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              className="button-secondary"
              href={buildExportHref(activeQuery)}
              prefetch={false}
            >
              Export CSV
            </Link>
            <Link className="button-secondary" href="/app/reports">
              Reset filters
            </Link>
          </div>
        </div>

        <form className="mt-6 space-y-4" method="get">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted-foreground)]">From</span>
              <input
                className="input"
                defaultValue={overview.range.from}
                name="from"
                type="date"
              />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted-foreground)]">To</span>
              <input
                className="input"
                defaultValue={overview.range.to}
                name="to"
                type="date"
              />
            </label>
            <button className="button-primary self-end" type="submit">
              Apply report
            </button>
          </div>

          <details
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4"
            open={hasAdvancedFilters}
          >
            <summary className="cursor-pointer list-none text-sm font-semibold">
              Advanced filters
            </summary>
            <div className="mt-4 grid gap-6 xl:grid-cols-2">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-[var(--muted-foreground)]">
                  Order statuses
                </legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {ORDER_STATUS_VALUES.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                    >
                      <input
                        defaultChecked={activeOrderStatuses.includes(status)}
                        name="orderStatus"
                        type="checkbox"
                        value={status}
                      />
                      <span>{ORDER_STATUS_LABELS[status]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-[var(--muted-foreground)]">
                  Inquiry stages
                </legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {INQUIRY_STAGE_VALUES.map((stage) => (
                    <label
                      key={stage}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                    >
                      <input
                        defaultChecked={activeInquiryStages.includes(stage)}
                        name="inquiryStage"
                        type="checkbox"
                        value={stage}
                      />
                      <span>{INQUIRY_STAGE_LABELS[stage]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>
        </form>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            className="rounded-full border border-[var(--border)] px-4 py-2 text-[var(--muted-foreground)] hover:bg-black/4"
            href={buildReportHref({
              ...activeQuery,
              from: formatDateInputValue(lastWeekStart),
              to: formatDateInputValue(today),
            })}
          >
            Last 7 days
          </Link>
          <Link
            className="rounded-full border border-[var(--border)] px-4 py-2 text-[var(--muted-foreground)] hover:bg-black/4"
            href={buildReportHref({
              ...activeQuery,
              from: formatDateInputValue(lastMonthStart),
              to: formatDateInputValue(today),
            })}
          >
            Last 30 days
          </Link>
          <Link
            className="rounded-full border border-[var(--border)] px-4 py-2 text-[var(--muted-foreground)] hover:bg-black/4"
            href={buildReportHref({
              ...activeQuery,
              from: formatDateInputValue(lastQuarterStart),
              to: formatDateInputValue(today),
            })}
          >
            Last 90 days
          </Link>
          <span className="rounded-full bg-[var(--panel-strong)] px-4 py-2 text-[var(--muted-foreground)]">
            {overview.range.days} day range
          </span>
          {hasAdvancedFilters && (
            <span className="rounded-full bg-[var(--panel-strong)] px-4 py-2 text-[var(--muted-foreground)]">
              Advanced filters active
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards
          .filter((item) => item.show)
          .map((item) => (
            <article key={item.label} className="panel">
              <p className="text-sm text-[var(--muted-foreground)]">{item.label}</p>
              <h2 className="mt-2 text-3xl font-semibold">{item.value}</h2>
            </article>
          ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {canViewOrders && (
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Current order pipeline
            </p>
            <div className="mt-5 space-y-4">
              {overview.currentPipeline.orderStatuses.map((entry) => (
                <div key={entry.status}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span>{ORDER_STATUS_LABELS[entry.status]}</span>
                    <span className="text-[var(--muted-foreground)]">{entry.count}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--panel-strong)]">
                    <div
                      className="h-3 rounded-full bg-slate-900"
                      style={{ width: `${(entry.count / maxOrderStatus) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}

        {canViewCrm && (
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Current CRM pipeline
            </p>
            <div className="mt-5 space-y-4">
              {overview.currentPipeline.inquiryStages.map((entry) => (
                <div key={entry.stage}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span>{INQUIRY_STAGE_LABELS[entry.stage]}</span>
                    <span className="text-[var(--muted-foreground)]">{entry.count}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--panel-strong)]">
                    <div
                      className="h-3 rounded-full bg-emerald-600"
                      style={{ width: `${(entry.count / maxInquiryStage) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>

      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Activity series
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Day-by-day movement</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Day</th>
                <th className="px-4 py-3 font-medium">Orders created</th>
                <th className="px-4 py-3 font-medium">Orders delivered</th>
                <th className="px-4 py-3 font-medium">Customers added</th>
                <th className="px-4 py-3 font-medium">Inquiries created</th>
              </tr>
            </thead>
            <tbody>
              {overview.activitySeries.map((entry) => (
                <tr key={entry.date} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{formatDayLabel(entry.date)}</td>
                  <td className="px-4 py-3">{entry.ordersCreated}</td>
                  <td className="px-4 py-3">{entry.ordersDelivered}</td>
                  <td className="px-4 py-3">{entry.customersAdded}</td>
                  <td className="px-4 py-3">{entry.inquiriesCreated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Monthly trends
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Month-by-month summary</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Orders created</th>
                <th className="px-4 py-3 font-medium">Orders delivered</th>
                <th className="px-4 py-3 font-medium">Customers added</th>
                <th className="px-4 py-3 font-medium">Inquiries created</th>
                <th className="px-4 py-3 font-medium">Quoted revenue</th>
                <th className="px-4 py-3 font-medium">Delivered revenue</th>
              </tr>
            </thead>
            <tbody>
              {overview.monthlySeries.map((entry) => (
                <tr key={entry.month} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{formatMonthLabel(entry.month)}</td>
                  <td className="px-4 py-3">{entry.ordersCreated}</td>
                  <td className="px-4 py-3">{entry.ordersDelivered}</td>
                  <td className="px-4 py-3">{entry.customersAdded}</td>
                  <td className="px-4 py-3">{entry.inquiriesCreated}</td>
                  <td className="px-4 py-3">{formatCurrency(entry.quotedRevenue, session.factoryCurrency)}</td>
                  <td className="px-4 py-3">{formatCurrency(entry.deliveredRevenue, session.factoryCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {canViewOrders && (
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Top customers
            </p>
            <div className="mt-5 space-y-3">
              {overview.topCustomers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No customer revenue activity in this range.
                </p>
              ) : (
                overview.topCustomers.map((customer) => (
                  <div
                    key={customer.customerId}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{customer.customerName}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {customer.orderCount} created orders in range
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{formatCurrency(customer.quotedRevenue, session.factoryCurrency)}</p>
                        <p className="mt-1 text-[var(--muted-foreground)]">
                          Delivered: {formatCurrency(customer.deliveredRevenue, session.factoryCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        )}

        {canViewProduction && (
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Worker output
            </p>
            <div className="mt-5 space-y-3">
              {overview.workerOutput.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No worker assignment activity yet.
                </p>
              ) : (
                overview.workerOutput.map((worker) => (
                  <div
                    key={worker.workerId}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-semibold">{worker.workerName}</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {worker.completedAssignments} completed
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                      <p>In progress: {worker.inProgressAssignments}</p>
                      <p>Planned: {worker.plannedAssignments}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {canViewOrders && (
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Overdue orders
            </p>
            <div className="mt-5 space-y-3">
              {overview.overdueOrderList.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No overdue orders right now.
                </p>
              ) : (
                overview.overdueOrderList.map((order) => (
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
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {order.daysLate} days late
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                      <p>Customer: {order.customerName}</p>
                      <p>Status: {ORDER_STATUS_LABELS[order.status]}</p>
                      <p>Target: {formatDate(order.targetDate)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        )}

        {canViewCrm && (
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Follow-up queue
            </p>
            <div className="mt-5 space-y-3">
              {overview.followUpList.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No follow-ups due in this range.
                </p>
              ) : (
                overview.followUpList.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{inquiry.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {inquiry.phone}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {INQUIRY_STAGE_LABELS[inquiry.stage]}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                      <p>Follow-up: {formatDate(inquiry.nextFollowUpAt)}</p>
                      <p>Assignee: {inquiry.assignedToName || "Unassigned"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
