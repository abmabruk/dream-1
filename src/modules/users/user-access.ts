import type { UserRole } from "@/modules/auth/roles";

export const INTERNAL_USER_ROLES = [
  "OWNER",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "ACCOUNTANT",
] as const;

export const USER_STATUS_VALUES = ["ACTIVE", "INVITED", "DISABLED"] as const;
export const MANAGEABLE_USER_STATUSES = ["ACTIVE", "DISABLED"] as const;

export type InternalUserRole = (typeof INTERNAL_USER_ROLES)[number];
export type AppUserStatus = (typeof USER_STATUS_VALUES)[number];
export type ManageableUserStatus = (typeof MANAGEABLE_USER_STATUSES)[number];

export const INTERNAL_USER_ROLE_LABELS: Record<InternalUserRole, string> = {
  OWNER: "مالك",
  FACTORY_MANAGER: "مدير المصنع",
  SALES_MANAGER: "مدير المبيعات",
  SUPERVISOR: "مشرف",
  WORKER: "عامل",
  ACCOUNTANT: "محاسب",
};

export const USER_STATUS_LABELS: Record<AppUserStatus, string> = {
  ACTIVE: "نشط",
  INVITED: "مدعو",
  DISABLED: "معطل",
};

export const MANAGEABLE_USER_STATUS_LABELS: Record<ManageableUserStatus, string> = {
  ACTIVE: "نشط",
  DISABLED: "معطل",
};

const MANAGEABLE_ROLES_BY_ACTOR: Record<UserRole, readonly InternalUserRole[]> = {
  OWNER: INTERNAL_USER_ROLES,
  FACTORY_MANAGER: ["SALES_MANAGER", "SUPERVISOR", "WORKER", "ACCOUNTANT"],
  SALES_MANAGER: [],
  SUPERVISOR: [],
  WORKER: [],
  ACCOUNTANT: [],
  CUSTOMER: [],
};

export function getManageableRoles(actorRole: UserRole): InternalUserRole[] {
  return [...MANAGEABLE_ROLES_BY_ACTOR[actorRole]];
}

export function canManageRole(actorRole: UserRole, targetRole: UserRole) {
  return MANAGEABLE_ROLES_BY_ACTOR[actorRole].includes(
    targetRole as InternalUserRole
  );
}

export function canManageUser(
  actorRole: UserRole,
  actorUserId: string,
  target: {
    id: string;
    role: UserRole;
  }
) {
  if (actorUserId === target.id) {
    return false;
  }

  return canManageRole(actorRole, target.role);
}

export function getManagementBlockReason(
  actorRole: UserRole,
  actorUserId: string,
  target: {
    id: string;
    role: UserRole;
  }
) {
  if (actorUserId === target.id) {
    return "هذا حسابك الحالي. تغيير الدور والحالة الذاتية غير مسموح به هنا.";
  }

  if (!canManageRole(actorRole, target.role)) {
    return "دورك لا يملك صلاحية إدارة هذا الحساب.";
  }

  return null;
}
