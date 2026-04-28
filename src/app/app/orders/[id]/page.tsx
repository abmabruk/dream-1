import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { OrderService } from "@/modules/orders/order.service";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "@/modules/orders/order-status";
import { PortalService } from "@/modules/portal/portal.service";
import { UserService } from "@/modules/users/user.service";

import { CreatePortalAccessForm } from "./create-portal-access-form";
import { CreateAssignmentForm } from "./create-assignment-form";
import { UpdateOrderStatusForm } from "./update-order-status-form";
import { formatDateAr, formatSAR } from "@/lib/format";

const orderService = new OrderService();
const userService = new UserService();
const portalService = new PortalService();

function formatDate(value: string | null) {
  if (!value) return "غير محدد";
  return formatDateAr(value);
}

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return "غير مسعّر";
  return formatSAR(value, { currency });
}

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  const session = await requirePermission("orders:view");
  const { id } = await params;
  const canUpdateStatus = hasPermission(session.role, "orders:update");
  const canAssign = hasPermission(session.role, "production:assign");

  const [order, workers] = await Promise.all([
    orderService.getById(session.factoryId, id),
    canAssign ? userService.listAssignable(session.factoryId) : Promise.resolve([]),
  ]);

  if (!order) {
    notFound();
  }

  const allowedStatuses = ORDER_STATUS_TRANSITIONS[order.status];
  const portalAccess = await portalService.getStaffPortalAccess(session.factoryId, order.id);

  return (
    <main className="space-y-6">
      <section className="panel">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <Link className="button-secondary" href="/app/orders">
            العودة إلى الطلبات
          </Link>
          <span>{order.code}</span>
        </div>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              تفاصيل الطلب
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {order.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
              {order.description || "لا يوجد وصف بعد."}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              الحالة الحالية
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {ORDER_STATUS_LABELS[order.status]}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">العميل</p>
          <h2 className="mt-2 text-xl font-semibold">{order.customer.name}</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {order.customer.phone || order.customer.email || "لا تتوفر بيانات اتصال"}
          </p>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">تاريخ الهدف</p>
          <h2 className="mt-2 text-xl font-semibold">{formatDate(order.targetDate)}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">المبلغ المسعّر</p>
          <h2 className="mt-2 text-xl font-semibold">
            {formatCurrency(order.quotedAmount, session.factoryCurrency)}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">المهام</p>
          <h2 className="mt-2 text-xl font-semibold">{order.assignments.length}</h2>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              سير العمل
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm">
                <span className="text-[var(--muted-foreground)]">تاريخ الإنشاء:</span>{" "}
                {formatDate(order.createdAt)}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm">
                <span className="text-[var(--muted-foreground)]">تاريخ الاعتماد:</span>{" "}
                {formatDate(order.approvedAt)}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm">
                <span className="text-[var(--muted-foreground)]">موافقة العميل:</span>{" "}
                {formatDate(order.customerApprovedAt)}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm">
                <span className="text-[var(--muted-foreground)]">تاريخ التسليم:</span>{" "}
                {formatDate(order.deliveredAt)}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm">
                <span className="text-[var(--muted-foreground)]">أنشأ بواسطة:</span>{" "}
                {order.createdByName || "غير معروف"}
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              بوابة العميل
            </p>
            <h2 className="mt-2 text-2xl font-semibold">شارك رابطاً مباشراً مع العميل.</h2>
            <div className="mt-5 space-y-4">
              {portalAccess ? (
                <>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                    <p className="text-sm text-[var(--muted-foreground)]">رابط البوابة</p>
                    <a
                      className="mt-2 block break-all text-sm font-medium text-[var(--accent)] underline"
                      href={portalAccess.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {portalAccess.url}
                    </a>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm">
                      <span className="text-[var(--muted-foreground)]">تاريخ المشاركة:</span>{" "}
                      {formatDate(portalAccess.createdAt)}
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm">
                      <span className="text-[var(--muted-foreground)]">آخر مشاهدة:</span>{" "}
                      {formatDate(portalAccess.lastViewedAt)}
                    </div>
                  </div>
                </>
              ) : (
                <CreatePortalAccessForm orderId={order.id} />
              )}
              {order.customerApprovalNote && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
                  ملاحظة العميل: {order.customerApprovalNote}
                </div>
              )}
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              تغيير الحالة
            </p>
            <h2 className="mt-2 text-2xl font-semibold">انقل الطلب للأمام مع سجل تدقيق.</h2>
            <div className="mt-5">
              {canUpdateStatus ? (
                <UpdateOrderStatusForm
                  allowedStatuses={allowedStatuses}
                  currentStatus={order.status}
                  orderId={order.id}
                />
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  يمكن لدورك عرض الطلبات لكن لا يمكنه تغيير حالتها.
                </p>
              )}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  مهام الإنتاج
                </p>
                <h2 className="mt-2 text-2xl font-semibold">المهام الحالية</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {order.assignments.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  لا توجد مهام بعد.
                </p>
              ) : (
                order.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{assignment.station}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {assignment.workerName} ({assignment.workerRole})
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {assignment.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
                      <span>المجدول: {formatDate(assignment.scheduledFor)}</span>
                      <span>تاريخ الإنشاء: {formatDate(assignment.createdAt)}</span>
                    </div>
                    {assignment.notes && (
                      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                        {assignment.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-[var(--border)] pt-6">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                إضافة مهمة
              </p>
              <div className="mt-4">
                {canAssign ? (
                  <CreateAssignmentForm orderId={order.id} workers={workers} />
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    يمكن لدورك عرض معلومات الإنتاج لكن لا يمكنه إنشاء مهام.
                  </p>
                )}
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              نشاط الطلب
            </p>
            <div className="mt-5 space-y-3">
              {order.events.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  لا توجد أحداث سير عمل بعد.
                </p>
              ) : (
                order.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{{STATUS_CHANGED: "تغيير الحالة", ASSIGNMENT_CREATED: "إنشاء مهمة", ASSIGNMENT_UPDATED: "تحديث مهمة", PORTAL_ACCESS_CREATED: "إنشاء وصول بوابة", NOTE_ADDED: "إضافة ملاحظة", CREATED: "إنشاء"} [event.type] ?? event.type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {event.actorName || "النظام"} في {formatDate(event.createdAt)}
                        </p>
                      </div>
                      {event.toStatus && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {ORDER_STATUS_LABELS[event.toStatus]}
                        </span>
                      )}
                    </div>
                    {(event.fromStatus || event.toStatus) && (
                      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                        {event.fromStatus
                          ? `${ORDER_STATUS_LABELS[event.fromStatus]} -> ${event.toStatus ? ORDER_STATUS_LABELS[event.toStatus] : "لا توجد حالة"}`
                          : `نُقل إلى ${event.toStatus ? ORDER_STATUS_LABELS[event.toStatus] : "لا توجد حالة"}`}
                      </p>
                    )}
                    {event.note && (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
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
