import "server-only";

import { UserStatus } from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import type { AppSession } from "@/modules/auth/session";
import { hashPassword } from "@/modules/auth/password";
import {
  canManageUser,
  getManageableRoles,
} from "./user-access";
import {
  createManagedUserSchema,
  resetManagedUserPasswordSchema,
  updateManagedUserSchema,
} from "./user.schemas";
import { UserRepository } from "./user.repository";

export class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  async list(factoryId: string) {
    return this.repository.listByFactory(factoryId);
  }

  async listAssignable(factoryId: string) {
    return this.repository.listAssignableByFactory(factoryId);
  }

  async create(
    factoryId: string,
    actor: Pick<AppSession, "userId" | "role">,
    input: unknown
  ) {
    const parsed = createManagedUserSchema.parse(input);

    if (!getManageableRoles(actor.role).includes(parsed.role)) {
      throw new HttpError(403, "You cannot create users with that role.");
    }

    const existing = await this.repository.findByEmail(parsed.email);

    if (existing) {
      throw new HttpError(409, "A user with this email already exists.");
    }

    return this.repository.create(factoryId, {
      ...parsed,
      passwordHash: hashPassword(parsed.password),
    });
  }

  async updateManagedUser(
    factoryId: string,
    actor: Pick<AppSession, "userId" | "role">,
    input: unknown
  ) {
    const parsed = updateManagedUserSchema.parse(input);
    const target = await this.repository.findById(factoryId, parsed.userId);

    if (!target) {
      throw new HttpError(404, "User not found.");
    }

    if (!canManageUser(actor.role, actor.userId, target)) {
      throw new HttpError(403, "You cannot manage this user.");
    }

    if (!getManageableRoles(actor.role).includes(parsed.role)) {
      throw new HttpError(403, "You cannot assign that role.");
    }

    if (
      target.role === "OWNER" &&
      target.status === "ACTIVE" &&
      (parsed.role !== "OWNER" || parsed.status !== "ACTIVE")
    ) {
      const activeOwners = await this.repository.countActiveOwners(factoryId);

      if (activeOwners <= 1) {
        throw new HttpError(409, "At least one active owner must remain.");
      }
    }

    return this.repository.update(factoryId, parsed);
  }

  async resetPassword(
    factoryId: string,
    actor: Pick<AppSession, "userId" | "role">,
    input: unknown
  ) {
    const parsed = resetManagedUserPasswordSchema.parse(input);
    const target = await this.repository.findById(factoryId, parsed.userId);

    if (!target) {
      throw new HttpError(404, "User not found.");
    }

    if (!canManageUser(actor.role, actor.userId, target)) {
      throw new HttpError(403, "You cannot reset this user's password.");
    }

    return this.repository.updatePassword(factoryId, {
      ...parsed,
      passwordHash: hashPassword(parsed.password),
      nextStatus: target.status === "INVITED" ? UserStatus.ACTIVE : undefined,
    });
  }
}
