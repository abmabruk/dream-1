export const USER_ROLES = [
  "OWNER",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "ACCOUNTANT",
  "CUSTOMER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  "dashboard:view",
  "notifications:view",
  "reports:view",
  "ops:view",
  "ops:manage",
  "projects:view",
  "projects:manage",
  "crm:view",
  "crm:manage",
  "orders:view",
  "orders:create",
  "orders:update",
  "production:view",
  "production:assign",
  "payments:view",
  "users:manage",
  "settings:manage",
  "portal:view",
  "costs:view",
  "costs:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: PERMISSIONS.slice(),
  FACTORY_MANAGER: [
    "dashboard:view",
    "notifications:view",
    "reports:view",
    "ops:view",
    "ops:manage",
    "projects:view",
    "projects:manage",
    "crm:view",
    "crm:manage",
    "orders:view",
    "orders:create",
    "orders:update",
    "production:view",
    "production:assign",
    "payments:view",
    "users:manage",
    "settings:manage",
    "costs:view",
  ],
  SALES_MANAGER: [
    "dashboard:view",
    "notifications:view",
    "reports:view",
    "ops:view",
    "projects:view",
    "crm:view",
    "crm:manage",
    "orders:view",
    "orders:create",
    "orders:update",
    "payments:view",
    "portal:view",
  ],
  SUPERVISOR: [
    "dashboard:view",
    "notifications:view",
    "reports:view",
    "ops:view",
    "ops:manage",
    "projects:view",
    "projects:manage",
    "crm:view",
    "orders:view",
    "production:view",
    "production:assign",
  ],
  WORKER: ["production:view"],
  ACCOUNTANT: [
    "dashboard:view",
    "notifications:view",
    "reports:view",
    "crm:view",
    "orders:view",
    "payments:view",
    "costs:view",
    "costs:manage",
  ],
  CUSTOMER: ["portal:view"],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
