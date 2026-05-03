import { requirePermission } from "@/modules/auth/guards";
import {
  INQUIRY_SOURCE_LABELS,
  INQUIRY_STAGE_LABELS,
  INQUIRY_STAGE_VALUES,
} from "@/modules/crm/inquiry-stage";
import { InquiryService } from "@/modules/crm/inquiry.service";
import { hasPermission } from "@/modules/auth/roles";
import { UserService } from "@/modules/users/user.service";

import { formatSAR, formatDateAr, formatNumber } from "@/lib/format";
import { MetricCard } from "@/components/ui";

import { CreateInquiryForm } from "./create-inquiry-form";
import { UpdateInquiryStageForm } from "./update-inquiry-stage-form";

const inquiryService = new InquiryService();
const userService = new UserService();

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return "لا يوجد ميزانية";
  return formatSAR(value, { currency, decimals: 0 });
}

function formatDate(value: string | null) {
  if (!value) return "لا يوجد متابعة";
  return formatDateAr(value);
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
          إدارة العلاقات
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          خط أنابيب الاستفسارات الحقيقي
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          يُخزَّن العملاء المحتملون الآن كسجلات حقيقية بمرحلة ومصدر وتاريخ متابعة
          وميزانية ومسند إليه. هذه الصفحة مدعومة بقاعدة البيانات بدلاً من بطاقات تجريبية.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {INQUIRY_STAGE_VALUES.map((stage) => (
          <MetricCard
            key={stage}
            label={INQUIRY_STAGE_LABELS[stage]}
            value={formatNumber(inquiriesByStage[stage].length)}
            tone={inquiriesByStage[stage].length > 0 ? "default" : "muted"}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        {canManage ? (
          <CreateInquiryForm assignees={assignees} />
        ) : (
          <section className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              وصول إدارة العلاقات
            </p>
            <h2 className="mt-2 text-2xl font-semibold">وصول للعرض فقط</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              يمكن لدورك مراجعة بيانات خط الأنابيب لكن لا يمكنه إنشاء الاستفسارات أو تحريكها.
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
                    {inquiriesByStage[stage].length} استفسارات
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {inquiriesByStage[stage].length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[var(--muted-foreground)]">
                    <svg className="mx-auto mb-3 opacity-40" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
                      <rect x="4" y="6" width="24" height="20" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 12h12M10 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="text-sm font-medium">لا توجد استفسارات في هذه المرحلة.</p>
                  </div>
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
                      <span className="rounded-full bg-[var(--panel-strong)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        {INQUIRY_SOURCE_LABELS[inquiry.source]}
                      </span>
                    </div>

                      <div className="mt-4 grid gap-3 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                        <p>الاهتمام: {inquiry.interest || "غير محدد"}</p>
                        <p>الميزانية: {formatCurrency(inquiry.budgetAmount, session.factoryCurrency)}</p>
                        <p>المتابعة: {formatDate(inquiry.nextFollowUpAt)}</p>
                        <p>المسند إليه: {inquiry.assignedToName || "غير مسند"}</p>
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
