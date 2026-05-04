import { describe, expect, it } from "vitest";

import { hasPermission, type UserRole } from "./roles";

const ROLES_WITH_VIEW: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
  "ACCOUNTANT",
];
const ROLES_WITHOUT_VIEW: UserRole[] = ["SUPERVISOR", "WORKER", "CUSTOMER"];

const ROLES_WITH_DRAFT: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
];
const ROLES_WITHOUT_DRAFT: UserRole[] = [
  "ACCOUNTANT",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

const ROLES_WITH_APPROVE: UserRole[] = ["OWNER", "FACTORY_MANAGER"];
const ROLES_WITHOUT_APPROVE: UserRole[] = [
  "SALES_MANAGER",
  "ACCOUNTANT",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

const ROLES_WITH_CANCEL: UserRole[] = ["OWNER", "FACTORY_MANAGER"];
const ROLES_WITHOUT_CANCEL: UserRole[] = [
  "SALES_MANAGER",
  "ACCOUNTANT",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

describe("quotes:view permission matrix", () => {
  it.each(ROLES_WITH_VIEW)("%s has quotes:view", (role) => {
    expect(hasPermission(role, "quotes:view")).toBe(true);
  });

  it.each(ROLES_WITHOUT_VIEW)("%s does NOT have quotes:view", (role) => {
    expect(hasPermission(role, "quotes:view")).toBe(false);
  });
});

describe("quotes:draft permission matrix", () => {
  it.each(ROLES_WITH_DRAFT)("%s has quotes:draft", (role) => {
    expect(hasPermission(role, "quotes:draft")).toBe(true);
  });

  it.each(ROLES_WITHOUT_DRAFT)("%s does NOT have quotes:draft", (role) => {
    expect(hasPermission(role, "quotes:draft")).toBe(false);
  });
});

describe("quotes:approve permission matrix", () => {
  it.each(ROLES_WITH_APPROVE)("%s has quotes:approve", (role) => {
    expect(hasPermission(role, "quotes:approve")).toBe(true);
  });

  it.each(ROLES_WITHOUT_APPROVE)("%s does NOT have quotes:approve", (role) => {
    expect(hasPermission(role, "quotes:approve")).toBe(false);
  });
});

describe("quotes:cancel permission matrix", () => {
  it.each(ROLES_WITH_CANCEL)("%s has quotes:cancel", (role) => {
    expect(hasPermission(role, "quotes:cancel")).toBe(true);
  });

  it.each(ROLES_WITHOUT_CANCEL)("%s does NOT have quotes:cancel", (role) => {
    expect(hasPermission(role, "quotes:cancel")).toBe(false);
  });
});

describe("Plan invariant: anyone who can approve quotes can also view them", () => {
  it.each(ROLES_WITH_APPROVE)("%s can also view quotes", (role) => {
    expect(hasPermission(role, "quotes:view")).toBe(true);
  });
});

describe("Plan invariant: anyone who can draft quotes can also view them", () => {
  it.each(ROLES_WITH_DRAFT)("%s can also view quotes", (role) => {
    expect(hasPermission(role, "quotes:view")).toBe(true);
  });
});

describe("Plan invariant: anyone who can cancel quotes can also approve them", () => {
  it.each(ROLES_WITH_CANCEL)("%s can also approve quotes", (role) => {
    expect(hasPermission(role, "quotes:approve")).toBe(true);
  });
});
