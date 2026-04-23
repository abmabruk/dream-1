import { describe, expect, it } from "vitest";

import {
  canManageRole,
  canManageUser,
  getManageableRoles,
  getManagementBlockReason,
} from "./user-access";

describe("user access guardrails", () => {
  it("allows factory managers to manage only non-admin internal roles", () => {
    expect(getManageableRoles("FACTORY_MANAGER")).toEqual([
      "SALES_MANAGER",
      "SUPERVISOR",
      "WORKER",
      "ACCOUNTANT",
    ]);
    expect(canManageRole("FACTORY_MANAGER", "OWNER")).toBe(false);
    expect(canManageRole("FACTORY_MANAGER", "WORKER")).toBe(true);
  });

  it("blocks self-management even when the role could manage others", () => {
    expect(
      canManageUser("OWNER", "user_1", {
        id: "user_1",
        role: "OWNER",
      })
    ).toBe(false);
  });

  it("returns a clear reason when the actor cannot manage the target", () => {
    expect(
      getManagementBlockReason("FACTORY_MANAGER", "manager_1", {
        id: "owner_1",
        role: "OWNER",
      })
    ).toBe("Your role cannot manage this account.");

    expect(
      getManagementBlockReason("OWNER", "owner_1", {
        id: "owner_1",
        role: "OWNER",
      })
    ).toBe(
      "This is your current account. Self role and status changes are blocked here."
    );
  });
});
