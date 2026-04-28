import { requirePermission } from "@/modules/auth/guards";
import {
  getManageableRoles,
  getManagementBlockReason,
  INTERNAL_USER_ROLE_LABELS,
  USER_STATUS_LABELS,
} from "@/modules/users/user-access";
import { UserService } from "@/modules/users/user.service";

import { formatDateAr } from "@/lib/format";

import { CreateUserForm } from "./create-user-form";
import { ManageUserForm } from "./manage-user-form";
import { ResetUserPasswordForm } from "./reset-user-password-form";

const userService = new UserService();



export default async function UsersPage() {
  const session = await requirePermission("users:manage");
  const users = await userService.list(session.factoryId);
  const manageableRoles = getManageableRoles(session.role);

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          المستخدمون
        </p>
        <h1 className="mt-3 text-3xl font-semibold">إدارة الفريق</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          تدير هذه الصفحة الآن مستخدمين حقيقيين محدّدي النطاق بالمصنع. يمكنك إنشاء أعضاء
          الفريق وضبط الوصول وتعطيل الحسابات وإعادة تعيين كلمات المرور مع تطبيق حواجز حماية
          الأدوار في طبقة الخدمة.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateUserForm availableRoles={manageableRoles} />

        <article className="panel space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              قواعد الإدارة
            </p>
            <h2 className="mt-2 text-2xl font-semibold">حواجز الحماية المطبّقة</h2>
          </div>
          <div className="space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
            <p>المستخدمون محدّدون بنطاق المصنع المسجل دخوله فقط.</p>
            <p>لا يمكن تخفيض رتبة حسابك الحالي أو تعطيله من هذه الصفحة.</p>
            <p>لا يمكن لمديري المصانع إدارة حسابات المالك أو مدير المصنع.</p>
            <p>لا يمكن إزالة آخر مالك نشط في المصنع.</p>
          </div>
        </article>
      </section>

      <section className="grid gap-4">
        {users.map((user) => {
          const blockReason = getManagementBlockReason(
            session.role,
            session.userId,
            user
          );
          const canManage = blockReason == null;

          return (
            <article key={user.id} className="panel">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold">{user.displayName}</h2>
                    <span className="rounded-full bg-[var(--panel-strong)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {INTERNAL_USER_ROLE_LABELS[user.role as keyof typeof INTERNAL_USER_ROLE_LABELS] ??
                        user.role}
                    </span>
                    <span
                      className={
                        user.status === "ACTIVE"
                          ? "rounded-full bg-[var(--tone-active-bg)] px-3 py-1 text-xs font-semibold text-[var(--tone-active-fg)]"
                          : user.status === "DISABLED"
                            ? "rounded-full bg-[var(--tone-blocked-bg)] px-3 py-1 text-xs font-semibold text-[var(--tone-blocked-fg)]"
                            : "rounded-full bg-[var(--tone-waiting-bg)] px-3 py-1 text-xs font-semibold text-[var(--tone-waiting-fg)]"
                      }
                    >
                      {USER_STATUS_LABELS[user.status]}
                    </span>
                    {user.id === session.userId && (
                      <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-foreground)]">
                        أنت
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-[var(--muted-foreground)] md:grid-cols-2 xl:grid-cols-4">
                    <p>البريد الإلكتروني: {user.email}</p>
                    <p>الهاتف: {user.phone || "غير محدد"}</p>
                    <p>الحالة: {USER_STATUS_LABELS[user.status]}</p>
                    <p>تاريخ الإنشاء: {formatDateAr(user.createdAt)}</p>
                  </div>
                </div>
              </div>

              {canManage ? (
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <ManageUserForm availableRoles={manageableRoles} user={user} />
                  <ResetUserPasswordForm userId={user.id} />
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
                  {blockReason}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
