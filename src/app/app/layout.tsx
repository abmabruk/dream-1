import Link from "next/link";

import { signOutAction } from "@/app/sign-in/actions";
import { CollapsibleSidebar } from "./_components/collapsible-sidebar";
import { ToastProvider } from "@/components/ui";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { QuickAdd } from "@/components/ui/QuickAdd";
import { ThemeToggle } from "@/components/theme-toggle";
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
    ? await getNotificationFeedCached(
        session.factoryId,
        session.userId,
        session.role,
      )
    : null;

  return (
    <ToastProvider>
      <div className="flex flex-col md:flex-row flex-1">
        <CollapsibleSidebar
          unreadNotifications={notifications?.summary.unread ?? 0}
          canViewNotifications={hasPermission(
            session.role,
            "notifications:view",
          )}
        >
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            دريم ١
          </p>
          <h2 className="mt-2 text-2xl font-semibold">مساحة العمليات</h2>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              مسجل الدخول
            </p>
            <p className="mt-2 font-semibold">{session.displayName}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {session.email}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {session.role}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {session.factoryName}
            </p>
          </div>
          <nav className="mt-8 flex flex-col gap-1 text-sm">
            {/* Top group: operations / dashboard / notifications / reports */}
            {hasPermission(session.role, "ops:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/ops"
              >
                عمليات اليوم
              </Link>
            )}
            {hasPermission(session.role, "ops:view") && (
              <Link
                className="flex items-center gap-2 rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/floor"
                target="_blank"
                rel="noopener noreferrer"
                title="افتح شاشة المصنع في علامة تبويب جديدة"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="2" y="4" width="20" height="13" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span>شاشة المصنع</span>
              </Link>
            )}
            {hasPermission(session.role, "projects:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/projects"
              >
                المشاريع
              </Link>
            )}
            {hasPermission(session.role, "dashboard:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app"
              >
                لوحة التحكم
              </Link>
            )}
            {hasPermission(session.role, "notifications:view") && (
              <Link
                className="flex items-center justify-between rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/notifications"
              >
                <span>الإشعارات</span>
                {notifications && notifications.summary.unread > 0 && (
                  <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-foreground)]">
                    {notifications.summary.unread}
                  </span>
                )}
              </Link>
            )}
            {hasPermission(session.role, "reports:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/reports"
              >
                التقارير
              </Link>
            )}

            {/* Middle group: relations / orders / customers / finance */}
            <hr className="my-3 border-0 border-t border-[var(--border)]" />
            {hasPermission(session.role, "crm:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/crm"
              >
                إدارة العلاقات
              </Link>
            )}
            {hasPermission(session.role, "orders:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/orders"
              >
                الطلبات
              </Link>
            )}
            {hasPermission(session.role, "customers:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/customers"
              >
                العملاء
              </Link>
            )}
            {hasPermission(session.role, "costs:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/finance"
              >
                الماليات
              </Link>
            )}
            {hasPermission(session.role, "invoices:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/finance/invoices"
              >
                الفواتير
              </Link>
            )}
            {hasPermission(session.role, "payments:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/finance/payments"
              >
                المدفوعات
              </Link>
            )}
            {hasPermission(session.role, "invoices:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/finance/aging"
              >
                تقرير الأعمار
              </Link>
            )}

            {/* Admin group: users / vendors / products / settings */}
            <hr className="my-3 border-0 border-t border-[var(--border)]" />
            {hasPermission(session.role, "vendors:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/vendors"
              >
                الموردون
              </Link>
            )}
            {hasPermission(session.role, "products:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/products"
              >
                المنتجات
              </Link>
            )}
            {hasPermission(session.role, "users:manage") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/users"
              >
                المستخدمون
              </Link>
            )}
            {hasPermission(session.role, "settings:manage") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/settings"
              >
                الإعدادات
              </Link>
            )}
            {hasPermission(session.role, "projects:manage") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/app/settings/stages"
              >
                إعدادات المراحل
              </Link>
            )}
            <Link
              className="rounded-2xl px-4 py-3 hover:bg-black/4"
              href="/app/settings/security"
            >
              الأمان (المصادقة الثنائية)
            </Link>

            {/* Other portals */}
            <hr className="my-3 border-0 border-t border-[var(--border)]" />
            <p className="px-4 pb-1 pt-1 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              بوابات أخرى
            </p>
            {hasPermission(session.role, "production:view") && (
              <Link
                className="rounded-2xl px-4 py-3 hover:bg-black/4"
                href="/worker"
              >
                بوابة العامل
              </Link>
            )}
            <Link
              className="rounded-2xl px-4 py-3 hover:bg-black/4"
              href="/portal"
            >
              بوابة العميل
            </Link>
          </nav>
          <div className="mt-8">
            <p className="mb-2 px-1 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              المظهر
            </p>
            <ThemeToggle />
          </div>
          <form action={signOutAction} className="mt-4">
            <button className="button-secondary w-full" type="submit">
              تسجيل الخروج
            </button>
          </form>
        </CollapsibleSidebar>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="dream-app-shell mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
            {children}
          </div>
        </div>
      </div>
      <CommandPalette />
      <QuickAdd />
    </ToastProvider>
  );
}
