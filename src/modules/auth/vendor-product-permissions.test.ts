import { describe, expect, it } from "vitest";

import { hasPermission, type UserRole } from "./roles";

// ──────────────────────────────────────────────────────────────
// vendors:view — OWNER, FACTORY_MANAGER, SALES_MANAGER, ACCOUNTANT
// ──────────────────────────────────────────────────────────────
const VENDORS_VIEW_WITH: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
  "ACCOUNTANT",
];
const VENDORS_VIEW_WITHOUT: UserRole[] = ["SUPERVISOR", "WORKER", "CUSTOMER"];

// ──────────────────────────────────────────────────────────────
// vendors:manage — OWNER, FACTORY_MANAGER, ACCOUNTANT
// ──────────────────────────────────────────────────────────────
const VENDORS_MANAGE_WITH: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "ACCOUNTANT",
];
const VENDORS_MANAGE_WITHOUT: UserRole[] = [
  "SALES_MANAGER",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

// ──────────────────────────────────────────────────────────────
// products:view — OWNER, FACTORY_MANAGER, SALES_MANAGER, ACCOUNTANT
// ──────────────────────────────────────────────────────────────
const PRODUCTS_VIEW_WITH: UserRole[] = [
  "OWNER",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
  "ACCOUNTANT",
];
const PRODUCTS_VIEW_WITHOUT: UserRole[] = ["SUPERVISOR", "WORKER", "CUSTOMER"];

// ──────────────────────────────────────────────────────────────
// products:manage — OWNER, FACTORY_MANAGER
// ──────────────────────────────────────────────────────────────
const PRODUCTS_MANAGE_WITH: UserRole[] = ["OWNER", "FACTORY_MANAGER"];
const PRODUCTS_MANAGE_WITHOUT: UserRole[] = [
  "SALES_MANAGER",
  "ACCOUNTANT",
  "SUPERVISOR",
  "WORKER",
  "CUSTOMER",
];

describe("vendors:view permission matrix", () => {
  it.each(VENDORS_VIEW_WITH)("%s has vendors:view", (role) => {
    expect(hasPermission(role, "vendors:view")).toBe(true);
  });
  it.each(VENDORS_VIEW_WITHOUT)("%s does NOT have vendors:view", (role) => {
    expect(hasPermission(role, "vendors:view")).toBe(false);
  });
});

describe("vendors:manage permission matrix", () => {
  it.each(VENDORS_MANAGE_WITH)("%s has vendors:manage", (role) => {
    expect(hasPermission(role, "vendors:manage")).toBe(true);
  });
  it.each(VENDORS_MANAGE_WITHOUT)("%s does NOT have vendors:manage", (role) => {
    expect(hasPermission(role, "vendors:manage")).toBe(false);
  });
});

describe("products:view permission matrix", () => {
  it.each(PRODUCTS_VIEW_WITH)("%s has products:view", (role) => {
    expect(hasPermission(role, "products:view")).toBe(true);
  });
  it.each(PRODUCTS_VIEW_WITHOUT)("%s does NOT have products:view", (role) => {
    expect(hasPermission(role, "products:view")).toBe(false);
  });
});

describe("products:manage permission matrix", () => {
  it.each(PRODUCTS_MANAGE_WITH)("%s has products:manage", (role) => {
    expect(hasPermission(role, "products:manage")).toBe(true);
  });
  it.each(PRODUCTS_MANAGE_WITHOUT)("%s does NOT have products:manage", (role) => {
    expect(hasPermission(role, "products:manage")).toBe(false);
  });
});

describe("Plan invariant: anyone who can manage vendors can also view them", () => {
  it.each(VENDORS_MANAGE_WITH)("%s can also view vendors", (role) => {
    expect(hasPermission(role, "vendors:view")).toBe(true);
  });
});

describe("Plan invariant: anyone who can manage products can also view them", () => {
  it.each(PRODUCTS_MANAGE_WITH)("%s can also view products", (role) => {
    expect(hasPermission(role, "products:view")).toBe(true);
  });
});
