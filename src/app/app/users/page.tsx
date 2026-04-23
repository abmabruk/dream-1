import { requirePermission } from "@/modules/auth/guards";
import {
  getManageableRoles,
  getManagementBlockReason,
  INTERNAL_USER_ROLE_LABELS,
  USER_STATUS_LABELS,
} from "@/modules/users/user-access";
import { UserService } from "@/modules/users/user.service";

import { CreateUserForm } from "./create-user-form";
import { ManageUserForm } from "./manage-user-form";
import { ResetUserPasswordForm } from "./reset-user-password-form";

const userService = new UserService();

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function UsersPage() {
  const session = await requirePermission("users:manage");
  const users = await userService.list(session.factoryId);
  const manageableRoles = getManageableRoles(session.role);

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Users module
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Team administration</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          This page now manages real factory-scoped users. You can create team
          members, adjust access, disable accounts, and reset passwords with
          role guardrails applied in the service layer.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateUserForm availableRoles={manageableRoles} />

        <article className="panel space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Admin rules
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Guardrails in place</h2>
          </div>
          <div className="space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
            <p>Users are scoped to the signed-in factory only.</p>
            <p>Your current account cannot be demoted or disabled from this page.</p>
            <p>Factory managers cannot manage owner or factory manager accounts.</p>
            <p>The final active owner in a factory cannot be removed.</p>
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
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {INTERNAL_USER_ROLE_LABELS[user.role as keyof typeof INTERNAL_USER_ROLE_LABELS] ??
                        user.role}
                    </span>
                    <span
                      className={
                        user.status === "ACTIVE"
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                          : user.status === "DISABLED"
                            ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                            : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
                      }
                    >
                      {USER_STATUS_LABELS[user.status]}
                    </span>
                    {user.id === session.userId && (
                      <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                        You
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-[var(--muted-foreground)] md:grid-cols-2 xl:grid-cols-4">
                    <p>Email: {user.email}</p>
                    <p>Phone: {user.phone || "Not set"}</p>
                    <p>Status: {USER_STATUS_LABELS[user.status]}</p>
                    <p>Created: {formatDate(user.createdAt)}</p>
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
