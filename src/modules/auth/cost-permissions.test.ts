import { describe, expect, it } from "vitest";

import { hasPermission, type UserRole } from "./roles";

const ROLES_WITH_VIEW: UserRole[] = ["OWNER", "FACTORY_MANAGER", "ACCOUNTANT"];
const ROLES_WITHOUT_VIEW: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

const ROLES_WITH_MANAGE: UserRole[] = ["OWNER", "FACTORY_MANAGER", "ACCOUNTANT"];
const ROLES_WITHOUT_MANAGE: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

describe("costs:view permission matrix", () => {
  it.each(ROLES_WITH_VIEW)("%s has costs:view", (role) => {
    expect(hasPermission(role, "costs:view")).toBe(true);
  });

  it.each(ROLES_WITHOUT_VIEW)("%s does NOT have costs:view", (role) => {
    expect(hasPermission(role, "costs:view")).toBe(false);
  });
});

describe("costs:manage permission matrix", () => {
  it.each(ROLES_WITH_MANAGE)("%s has costs:manage", (role) => {
    expect(hasPermission(role, "costs:manage")).toBe(true);
  });

  it.each(ROLES_WITHOUT_MANAGE)("%s does NOT have costs:manage", (role) => {
    expect(hasPermission(role, "costs:manage")).toBe(false);
  });
});

describe("Plan invariant: anyone who can manage costs can also view them", () => {
  it.each(ROLES_WITH_MANAGE)("%s can also view costs", (role) => {
    expect(hasPermission(role, "costs:view")).toBe(true);
  });
});
