import { notFound } from "next/navigation";

import { ORDER_STATUS_LABELS } from "@/modules/orders/order-status";
import { PortalService } from "@/modules/portal/portal.service";

import { PortalApprovalForm } from "./approval-form";

const portalService = new PortalService();

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatCurrencyWithCode(value: number | null, currency: string) {
  if (value == null) {
    return "Not quoted";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PortalOrderPage({ params }: PageProps) {
  const { token } = await params;

  let detail: Awaited<ReturnType<PortalService["getPortalOrder"]>>;

  try {
    detail = await portalService.getPortalOrder(token);
  } catch {
    notFound();
  }

  if (!detail) {
    notFound();
  }

  const canApprove = detail.order.status === "QUOTED";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          {detail.factory.portalDisplayName || detail.factory.name}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {detail.order.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          Live visibility for order {detail.order.code}. This page reflects the
          actual status stored by {detail.factory.name}.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Current status</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {ORDER_STATUS_LABELS[detail.order.status]}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Target date</p>
          <h2 className="mt-2 text-2xl font-semibold">{formatDate(detail.order.targetDate)}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Quoted amount</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {formatCurrencyWithCode(detail.order.quotedAmount, detail.factory.currency)}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Delivered</p>
          <h2 className="mt-2 text-2xl font-semibold">{formatDate(detail.order.deliveredAt)}</h2>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Customer information
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Name:</span>{" "}
                {detail.order.customer.name}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Contact:</span>{" "}
                {detail.order.customer.phone || detail.order.customer.email || "No contact available"}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Customer approved:</span>{" "}
                {formatDate(detail.order.customerApprovedAt)}
              </div>
            </div>
            {detail.order.customerApprovalNote && (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
                Your note: {detail.order.customerApprovalNote}
              </div>
            )}
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Support
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Portal name:</span>{" "}
                {detail.factory.portalDisplayName || detail.factory.name}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Support email:</span>{" "}
                {detail.factory.supportEmail || "Not provided"}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Support phone:</span>{" "}
                {detail.factory.supportPhone || "Not provided"}
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Approval
            </p>
            <div className="mt-4">
              {canApprove ? (
                <PortalApprovalForm token={token} />
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  This order is not waiting for customer approval right now.
                </p>
              )}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Delivery visibility
            </p>
            <div className="mt-5 space-y-3">
              {detail.order.assignments.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No production activity has been scheduled yet.
                </p>
              ) : (
                detail.order.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{assignment.station}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          Scheduled: {formatDate(assignment.scheduledFor)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {assignment.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Timeline
            </p>
            <div className="mt-5 space-y-3">
              {detail.order.events.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No timeline updates yet.
                </p>
              ) : (
                detail.order.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{event.type.replaceAll("_", " ")}</p>
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
