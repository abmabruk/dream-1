"use client";

import { useActionState } from "react";

import type { UserListItem } from "@/modules/users/user.schemas";
import type {
  InternalUserRole,
  ManageableUserStatus,
} from "@/modules/users/user-access";
import {
  INTERNAL_USER_ROLE_LABELS,
  MANAGEABLE_USER_STATUSES,
  MANAGEABLE_USER_STATUS_LABELS,
} from "@/modules/users/user-access";

import {
  initialUserAdminActionState,
  updateUserAction,
} from "./actions";

export function ManageUserForm({
  availableRoles,
  user,
}: {
  availableRoles: InternalUserRole[];
  user: UserListItem;
}) {
  const [state, formAction, pending] = useActionState(
    updateUserAction,
    initialUserAdminActionState
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
      <input name="userId" type="hidden" value={user.id} />

      <div>
        <p className="text-sm font-semibold">Role and status</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Update access for this team member.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`role-${user.id}`}>
            Role
          </label>
          <select
            className="input-field"
            defaultValue={user.role}
            id={`role-${user.id}`}
            name="role"
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {INTERNAL_USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`status-${user.id}`}>
            Status
          </label>
          <select
            className="input-field"
            defaultValue={user.status === "INVITED" ? "ACTIVE" : user.status}
            id={`status-${user.id}`}
            name="status"
          >
            {MANAGEABLE_USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {MANAGEABLE_USER_STATUS_LABELS[status as ManageableUserStatus]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <button className="button-secondary disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving..." : "Save access"}
      </button>
    </form>
  );
}
