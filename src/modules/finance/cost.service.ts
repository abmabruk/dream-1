import "server-only";

import type { UserRole } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { HttpError } from "@/lib/http/http-error";
import { hasPermission } from "@/modules/auth/roles";
import { CostInput, CostCategoryEnum, type CostCategory } from "./cost.schemas";
import { CostRepository } from "./cost.repository";

export class CostService {
  constructor(private readonly repository = new CostRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "costs:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض التكاليف.");
    }
  }

  private assertManage(role: UserRole) {
    if (!hasPermission(role, "costs:manage")) {
      throw new HttpError(403, "ليس لديك صلاحية إدارة التكاليف.");
    }
  }

  async create(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    input: unknown,
  ) {
    this.assertManage(actor.role);
    const parsed = CostInput.parse(input);
    const created = await this.repository.create(
      factoryId,
      actor.userId,
      parsed,
    );
    await recordAudit({
      factoryId,
      actorUserId: actor.userId,
      actorRoleSnapshot: actor.role,
      action: "COST_CREATED",
      entityType: "Cost",
      entityId: created.id,
      metadata: {
        category: parsed.category,
        amount: String(parsed.amount),
        projectId: parsed.projectId ?? null,
      },
    });
    return created;
  }

  async deleteById(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    costId: string,
  ) {
    this.assertManage(actor.role);
    const result = await this.repository.deleteById(
      factoryId,
      actor.userId,
      costId,
    );
    await recordAudit({
      factoryId,
      actorUserId: actor.userId,
      actorRoleSnapshot: actor.role,
      action: "COST_DELETED",
      entityType: "Cost",
      entityId: costId,
    });
    return result;
  }

  async listByProject(factoryId: string, role: UserRole, projectId: string) {
    this.assertView(role);
    return this.repository.listByProject(factoryId, projectId);
  }

  async listByFactory(
    factoryId: string,
    role: UserRole,
    filters?: { from?: Date; to?: Date; categories?: CostCategory[] },
  ) {
    this.assertView(role);
    return this.repository.listByFactory(factoryId, filters);
  }

  async summaryByProject(factoryId: string, role: UserRole, projectId: string) {
    this.assertView(role);
    return this.repository.summaryByProject(factoryId, projectId);
  }

  async summaryByFactory(
    factoryId: string,
    role: UserRole,
    filters?: { from?: Date; to?: Date; categories?: CostCategory[] },
  ) {
    this.assertView(role);
    return this.repository.summaryByFactory(factoryId, filters);
  }

  parseCategoriesParam(
    input: string | null | undefined,
  ): CostCategory[] | undefined {
    if (!input) return undefined;
    const parts = input
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return undefined;
    return parts
      .map((p) => CostCategoryEnum.safeParse(p))
      .filter((r): r is { success: true; data: CostCategory } => r.success)
      .map((r) => r.data);
  }
}
