import { requirePermission } from "@/modules/auth/guards";
import {
  INQUIRY_SOURCE_LABELS,
  INQUIRY_STAGE_LABELS,
  INQUIRY_STAGE_VALUES,
} from "@/modules/crm/inquiry-stage";
import { InquiryService } from "@/modules/crm/inquiry.service";
import { hasPermission } from "@/modules/auth/roles";
import { UserService } from "@/modules/users/user.service";

import { CreateInquiryForm } from "./create-inquiry-form";
import { UpdateInquiryStageForm } from "./update-inquiry-stage-form";

const inquiryService = new InquiryService();
const userService = new UserService();

function formatCurrency(value: number | null, currency: string) {
  if (value == null) {
    return "No budget";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No follow-up";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function CrmPage() {
  const session = await requirePermission("crm:view");
  const canManage = hasPermission(session.role, "crm:manage");
  const [inquiries, users] = await Promise.all([
    inquiryService.list(session.factoryId),
    userService.list(session.factoryId),
  ]);

  const assignees = users.filter((user) =>
    ["OWNER", "FACTORY_MANAGER", "SALES_MANAGER", "SUPERVISOR"].includes(user.role)
  );

  const inquiriesByStage = Object.fromEntries(
    INQUIRY_STAGE_VALUES.map((stage) => [
      stage,
      inquiries.filter((inquiry) => inquiry.stage === stage),
    ])
  ) as Record<(typeof INQUIRY_STAGE_VALUES)[number], typeof inquiries>;

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          CRM
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Real inquiry pipeline
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          Leads are now stored as real records with stage, source, follow-up date,
          budget, and assignee. This page is powered by the database rather than
          demo cards.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {INQUIRY_STAGE_VALUES.map((stage) => (
          <article key={stage} className="panel">
            <p className="text-sm text-[var(--muted-foreground)]">
              {INQUIRY_STAGE_LABELS[stage]}
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              {inquiriesByStage[stage].length}
            </h2>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        {canManage ? (
          <CreateInquiryForm assignees={assignees} />
        ) : (
          <section className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              CRM access
            </p>
            <h2 className="mt-2 text-2xl font-semibold">View-only access</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              Your role can review pipeline data but cannot create or move inquiries.
            </p>
          </section>
        )}

        <div className="space-y-6">
          {INQUIRY_STAGE_VALUES.map((stage) => (
            <article key={stage} className="panel">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                    {INQUIRY_STAGE_LABELS[stage]}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {inquiriesByStage[stage].length} inquiries
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {inquiriesByStage[stage].length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No inquiries in this stage.
                  </p>
                ) : (
                  inquiriesByStage[stage].map((inquiry) => (
                    <div
                      key={inquiry.id}
                      id={`inquiry-${inquiry.id}`}
                      className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{inquiry.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {inquiry.phone}
                          {inquiry.email ? ` · ${inquiry.email}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {INQUIRY_SOURCE_LABELS[inquiry.source]}
                      </span>
                    </div>

                      <div className="mt-4 grid gap-3 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                        <p>Interest: {inquiry.interest || "Not set"}</p>
                        <p>Budget: {formatCurrency(inquiry.budgetAmount, session.factoryCurrency)}</p>
                        <p>Follow-up: {formatDate(inquiry.nextFollowUpAt)}</p>
                        <p>Assignee: {inquiry.assignedToName || "Unassigned"}</p>
                      </div>

                      {inquiry.notes && (
                        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                          {inquiry.notes}
                        </p>
                      )}

                      {canManage && (
                        <div className="mt-5 border-t border-[var(--border)] pt-5">
                          <UpdateInquiryStageForm
                            currentStage={inquiry.stage}
                            inquiryId={inquiry.id}
                            nextFollowUpAt={inquiry.nextFollowUpAt}
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
