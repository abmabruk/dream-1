import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import {
  getNotificationFeedCached,
} from "@/modules/notifications/notification.service";
import {
  NOTIFICATION_TYPE_LABELS,
  type NotificationListItem,
  type NotificationType,
} from "@/modules/notifications/notification.schemas";
import { MetricCard } from "@/components/ui";
import { formatDateAr, formatNumber } from "@/lib/format";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = formatDateAr(d);
  const time = new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

function getTypeClasses(type: NotificationType) {
  if (type === "ORDER_OVERDUE") {
    return "bg-[var(--tone-blocked-bg)] text-[var(--tone-blocked-fg)]";
  }

  if (type === "CRM_FOLLOW_UP_DUE") {
    return "bg-[var(--tone-waiting-bg)] text-[var(--tone-waiting-fg)]";
  }

  if (type === "ASSIGNMENT_BLOCKED") {
    return "bg-[var(--tone-waiting-bg)] text-[var(--tone-waiting-fg)]";
  }

  return "bg-[var(--tone-active-bg)] text-[var(--tone-active-fg)]";
}

function NotificationCard({
  notification,
  showReadAction,
}: {
  notification: NotificationListItem;
  showReadAction: boolean;
}) {
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getTypeClasses(notification.type)}`}
            >
              {NOTIFICATION_TYPE_LABELS[notification.type]}
            </span>
            <span
              className={
                notification.status === "UNREAD"
                  ? "rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-foreground)]"
                  : "rounded-full bg-[var(--panel-strong)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]"
              }
            >
              {notification.status === "UNREAD" ? "غير مقروء" : "مقروء"}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-semibold">{notification.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
            {notification.message}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted-foreground)]">
            <span>رُصد في: {formatDateTime(notification.createdAt)}</span>
            <span>حُدّث في: {formatDateTime(notification.updatedAt)}</span>
            {notification.readAt && <span>قُرئ في: {formatDateTime(notification.readAt)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {notification.href && (
            <Link className="button-secondary" href={notification.href}>
              فتح السجل
            </Link>
          )}
          {showReadAction && (
            <form action={markNotificationReadAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="button-primary" type="submit">
                تعيين كمقروء
              </button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function NotificationsPage() {
  const session = await requirePermission("notifications:view");
  const feed = await getNotificationFeedCached(
    session.factoryId,
    session.userId,
    session.role
  );

  return (
    <main className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              الإشعارات
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              قائمة تنبيهات العمليات المباشرة
            </h1>
            <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
              تُنشأ التنبيهات هنا من قاعدة البيانات الحقيقية للحساب المسجل دخوله.
              حالة القراءة خاصة بالمستخدم، بينما يرتبط محتوى التنبيه بالعمل المتأخر
              الفعلي والمتابعات والإنتاج المعطل وموافقات العملاء المعلّقة.
            </p>
          </div>

          <form action={markAllNotificationsReadAction}>
            <button
              className="button-secondary"
              disabled={feed.summary.unread === 0}
              type="submit"
            >
              تعيين الكل كمقروء
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="غير مقروء"
          value={formatNumber(feed.summary.unread)}
          tone={feed.summary.unread > 0 ? "accent" : "muted"}
        />
        <MetricCard
          label="مُعترف به"
          value={formatNumber(feed.summary.read)}
          tone="muted"
        />
        <MetricCard
          label="الطلبات المتأخرة"
          value={formatNumber(feed.summary.overdueOrders)}
          tone={feed.summary.overdueOrders > 0 ? "danger" : "muted"}
        />
        <MetricCard
          label="المتابعات المستحقة"
          value={formatNumber(feed.summary.dueFollowUps)}
          tone={feed.summary.dueFollowUps > 0 ? "warn" : "muted"}
        />
        <MetricCard
          label="المهام المعطّلة"
          value={formatNumber(feed.summary.blockedAssignments)}
          tone={feed.summary.blockedAssignments > 0 ? "warn" : "muted"}
        />
        <MetricCard
          label="الموافقات المعلّقة"
          value={formatNumber(feed.summary.pendingApprovals)}
          tone={feed.summary.pendingApprovals > 0 ? "warn" : "muted"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              التنبيهات غير المقروءة
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {feed.unread.length} عنصر نشط
            </h2>
          </div>

          {feed.unread.length === 0 ? (
            <article className="panel text-sm text-[var(--muted-foreground)]">
              لا توجد إشعارات غير مقروءة نشطة لحسابك الآن.
            </article>
          ) : (
            feed.unread.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                showReadAction
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              مُعترف به
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {feed.read.length} عنصر تمت مراجعته
            </h2>
          </div>

          {feed.read.length === 0 ? (
            <article className="panel text-sm text-[var(--muted-foreground)]">
              لم يُعيَّن أي شيء كمقروء بعد.
            </article>
          ) : (
            feed.read.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                showReadAction={false}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
