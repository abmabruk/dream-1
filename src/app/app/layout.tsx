import Link from "next/link";

import { signOutAction } from "@/app/sign-in/actions";
import { hasPermission } from "@/modules/auth/roles";
import { requireSession } from "@/modules/auth/session";
import { getNotificationFeedCached } from "@/modules/notifications/notification.service";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const notifications = hasPermission(session.role, "notifications:view")
    ? await getNotificationFeedCached(session.factoryId, session.userId, session.role)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-4 lg:px-8">
      <aside className="panel hidden w-72 shrink-0 lg:block">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Dream 1
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Operations workspace</h2>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Signed in
          </p>
          <p className="mt-2 font-semibold">{session.displayName}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{session.email}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{session.role}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{session.factoryName}</p>
        </div>
        <nav className="mt-8 flex flex-col gap-2 text-sm">
          {hasPermission(session.role, "ops:view") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/ops">
              Today ops
            </Link>
          )}
          {hasPermission(session.role, "projects:view") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/projects">
              Projects
            </Link>
          )}
          {hasPermission(session.role, "dashboard:view") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app">
              Dashboard
            </Link>
          )}
          {hasPermission(session.role, "notifications:view") && (
            <Link
              className="flex items-center justify-between rounded-2xl px-4 py-3 hover:bg-black/4"
              href="/app/notifications"
            >
              <span>Notifications</span>
              {notifications && notifications.summary.unread > 0 && (
                <span className="rounded-full bg-black px-2.5 py-0.5 text-xs font-semibold text-white">
                  {notifications.summary.unread}
                </span>
              )}
            </Link>
          )}
          {hasPermission(session.role, "reports:view") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/reports">
              Reporting
            </Link>
          )}
          {hasPermission(session.role, "crm:view") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/crm">
              CRM module
            </Link>
          )}
          {hasPermission(session.role, "orders:view") && (
            <>
              <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/orders">
                Orders module
              </Link>
              <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/customers">
                Customers module
              </Link>
            </>
          )}
          {hasPermission(session.role, "users:manage") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/users">
              Users module
            </Link>
          )}
          {hasPermission(session.role, "settings:manage") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/app/settings">
              Settings
            </Link>
          )}
          {hasPermission(session.role, "production:view") && (
            <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/worker">
              Worker entry
            </Link>
          )}
          <Link className="rounded-2xl px-4 py-3 hover:bg-black/4" href="/portal">
            Customer portal
          </Link>
        </nav>
        <form action={signOutAction} className="mt-8">
          <button className="button-secondary w-full" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
    </div>
  );
}
