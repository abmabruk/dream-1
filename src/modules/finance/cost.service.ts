import "server-only";

import type { UserRole } from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import { hasPermission } from "@/modules/auth/roles";
import {
  CostInput,
  CostCategoryEnum,
  type CostCategory,
} from "./cost.schemas";
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
    return this.repository.create(factoryId, actor.userId, parsed);
  }

  async deleteById(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    costId: string,
  ) {
    this.assertManage(actor.role);
    return this.repository.deleteById(factoryId, actor.userId, costId);
  }

  async listByProject(
    factoryId: string,
    role: UserRole,
    projectId: string,
  ) {
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

  async summaryByProject(
    factoryId: string,
    role: UserRole,
    projectId: string,
  ) {
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

  parseCategoriesParam(input: string | null | undefined): CostCategory[] | undefined {
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
