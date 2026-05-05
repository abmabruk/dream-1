import { describe, expect, it } from "vitest";

import { hasPermission, type UserRole } from "./roles";

const ROLES_WITH_VIEW: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "ACCOUNTANT",
  "SALES_MANAGER",
];
const ROLES_WITHOUT_VIEW: UserRole[] = ["SUPERVISOR", "WORKER", "CUSTOMER"];

const ROLES_WITH_MANAGE: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "ACCOUNTANT",
];
const ROLES_WITHOUT_MANAGE: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

describe("payments:view permission matrix", () => {
  it.each(ROLES_WITH_VIEW)("%s has payments:view", (role) => {
    expect(hasPermission(role, "payments:view")).toBe(true);
  });
  it.each(ROLES_WITHOUT_VIEW)("%s does NOT have payments:view", (role) => {
    expect(hasPermission(role, "payments:view")).toBe(false);
  });
});

describe("payments:manage permission matrix", () => {
  it.each(ROLES_WITH_MANAGE)("%s has payments:manage", (role) => {
    expect(hasPermission(role, "payments:manage")).toBe(true);
  });
  it.each(ROLES_WITHOUT_MANAGE)("%s does NOT have payments:manage", (role) => {
    expect(hasPermission(role, "payments:manage")).toBe(false);
  });
});

describe("Plan invariants", () => {
  it.each(ROLES_WITH_MANAGE)(
    "%s with payments:manage also has payments:view",
    (role) => {
      expect(hasPermission(role, "payments:view")).toBe(true);
    },
  );
});
