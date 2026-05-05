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

const ROLES_WITH_ISSUE: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "ACCOUNTANT",
];
const ROLES_WITHOUT_ISSUE: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

const ROLES_WITH_VOID: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "ACCOUNTANT",
];
const ROLES_WITHOUT_VOID: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

const ROLES_WITH_CREDIT_NOTES: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "ACCOUNTANT",
];
const ROLES_WITHOUT_CREDIT_NOTES: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

describe("invoices:view permission matrix", () => {
  it.each(ROLES_WITH_VIEW)("%s has invoices:view", (role) => {
    expect(hasPermission(role, "invoices:view")).toBe(true);
  });
  it.each(ROLES_WITHOUT_VIEW)("%s does NOT have invoices:view", (role) => {
    expect(hasPermission(role, "invoices:view")).toBe(false);
  });
});

describe("invoices:manage permission matrix", () => {
  it.each(ROLES_WITH_MANAGE)("%s has invoices:manage", (role) => {
    expect(hasPermission(role, "invoices:manage")).toBe(true);
  });
  it.each(ROLES_WITHOUT_MANAGE)("%s does NOT have invoices:manage", (role) => {
    expect(hasPermission(role, "invoices:manage")).toBe(false);
  });
});

describe("invoices:issue permission matrix", () => {
  it.each(ROLES_WITH_ISSUE)("%s has invoices:issue", (role) => {
    expect(hasPermission(role, "invoices:issue")).toBe(true);
  });
  it.each(ROLES_WITHOUT_ISSUE)("%s does NOT have invoices:issue", (role) => {
    expect(hasPermission(role, "invoices:issue")).toBe(false);
  });
});

describe("invoices:void permission matrix", () => {
  it.each(ROLES_WITH_VOID)("%s has invoices:void", (role) => {
    expect(hasPermission(role, "invoices:void")).toBe(true);
  });
  it.each(ROLES_WITHOUT_VOID)("%s does NOT have invoices:void", (role) => {
    expect(hasPermission(role, "invoices:void")).toBe(false);
  });
});

describe("credit-notes:manage permission matrix", () => {
  it.each(ROLES_WITH_CREDIT_NOTES)("%s has credit-notes:manage", (role) => {
    expect(hasPermission(role, "credit-notes:manage")).toBe(true);
  });
  it.each(ROLES_WITHOUT_CREDIT_NOTES)(
    "%s does NOT have credit-notes:manage",
    (role) => {
      expect(hasPermission(role, "credit-notes:manage")).toBe(false);
    },
  );
});

describe("Plan invariants", () => {
  it.each(ROLES_WITH_MANAGE)("%s with invoices:manage also has invoices:view", (role) => {
    expect(hasPermission(role, "invoices:view")).toBe(true);
  });
  it.each(ROLES_WITH_ISSUE)("%s with invoices:issue also has invoices:view", (role) => {
    expect(hasPermission(role, "invoices:view")).toBe(true);
  });
  it.each(ROLES_WITH_VOID)("%s with invoices:void also has invoices:view", (role) => {
    expect(hasPermission(role, "invoices:view")).toBe(true);
  });
  it.each(ROLES_WITH_CREDIT_NOTES)(
    "%s with credit-notes:manage also has invoices:view",
    (role) => {
      expect(hasPermission(role, "invoices:view")).toBe(true);
    },
  );
});
