import { describe, expect, it } from "vitest";

import { PERMISSIONS, hasPermission, rolePermissions } from "./roles";

describe("role permissions", () => {
  it("keeps owner access aligned with the full permission list", () => {
    expect(rolePermissions.OWNER).toEqual(PERMISSIONS);
  });

  it("limits workers to the production workspace only", () => {
    expect(rolePermissions.WORKER).toEqual(["production:view", "me:view"]);
    expect(hasPermission("WORKER", "notifications:view")).toBe(false);
    expect(hasPermission("WORKER", "production:view")).toBe(true);
    expect(hasPermission("WORKER", "me:view")).toBe(true);
  });

  it("grants accountants reporting and notification access without user management", () => {
    expect(hasPermission("ACCOUNTANT", "notifications:view")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "reports:view")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "users:manage")).toBe(false);
  });
});
