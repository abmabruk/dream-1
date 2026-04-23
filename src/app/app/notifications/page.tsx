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

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTypeClasses(type: NotificationType) {
  if (type === "ORDER_OVERDUE") {
    return "bg-red-100 text-red-700";
  }

  if (type === "CRM_FOLLOW_UP_DUE") {
    return "bg-amber-100 text-amber-700";
  }

  if (type === "ASSIGNMENT_BLOCKED") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-sky-100 text-sky-700";
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
                  ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              }
            >
              {notification.status === "UNREAD" ? "Unread" : "Read"}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-semibold">{notification.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
            {notification.message}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted-foreground)]">
            <span>Detected: {formatDateTime(notification.createdAt)}</span>
            <span>Updated: {formatDateTime(notification.updatedAt)}</span>
            {notification.readAt && <span>Read: {formatDateTime(notification.readAt)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {notification.href && (
            <Link className="button-secondary" href={notification.href}>
              Open record
            </Link>
          )}
          {showReadAction && (
            <form action={markNotificationReadAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="button-primary" type="submit">
                Mark read
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
              Notifications
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Live operations alert queue
            </h1>
            <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
              Alerts here are generated from the real database for your signed-in
              account. Read state is user-specific, while the alert content stays
              tied to actual overdue work, follow-ups, blocked production, and
              pending customer approvals.
            </p>
          </div>

          <form action={markAllNotificationsReadAction}>
            <button
              className="button-secondary"
              disabled={feed.summary.unread === 0}
              type="submit"
            >
              Mark all unread as read
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Unread</p>
          <h2 className="mt-2 text-3xl font-semibold">{feed.summary.unread}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Acknowledged</p>
          <h2 className="mt-2 text-3xl font-semibold">{feed.summary.read}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Overdue orders</p>
          <h2 className="mt-2 text-3xl font-semibold">{feed.summary.overdueOrders}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Due follow-ups</p>
          <h2 className="mt-2 text-3xl font-semibold">{feed.summary.dueFollowUps}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Blocked assignments</p>
          <h2 className="mt-2 text-3xl font-semibold">
            {feed.summary.blockedAssignments}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Pending approvals</p>
          <h2 className="mt-2 text-3xl font-semibold">
            {feed.summary.pendingApprovals}
          </h2>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Unread alerts
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {feed.unread.length} active item{feed.unread.length === 1 ? "" : "s"}
            </h2>
          </div>

          {feed.unread.length === 0 ? (
            <article className="panel text-sm text-[var(--muted-foreground)]">
              No unread notifications are active for your account right now.
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
              Acknowledged
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {feed.read.length} item{feed.read.length === 1 ? "" : "s"} already
              reviewed
            </h2>
          </div>

          {feed.read.length === 0 ? (
            <article className="panel text-sm text-[var(--muted-foreground)]">
              Nothing has been marked as read yet.
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
