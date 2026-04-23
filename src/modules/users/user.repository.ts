import "server-only";

import { UserRole, UserStatus } from "@prisma/client";

import { db } from "@/lib/db";

import type {
  AssignableWorker,
  CreateManagedUserInput,
  ResetManagedUserPasswordInput,
  UpdateManagedUserInput,
  UserListItem,
} from "./user.schemas";

const userListItemSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  phone: true,
  createdAt: true,
} as const;

function toUserListItem(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  createdAt: Date;
}): UserListItem {
  return {
    id: user.id,
    email: user.email,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    status: user.status,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
  };
}

export class UserRepository {
  async listByFactory(factoryId: string): Promise<UserListItem[]> {
    const users = await db.user.findMany({
      where: { factoryId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return users.map(toUserListItem);
  }

  async listAssignableByFactory(factoryId: string): Promise<AssignableWorker[]> {
    const users = await db.user.findMany({
      where: {
        factoryId,
        status: UserStatus.ACTIVE,
        role: {
          in: [UserRole.SUPERVISOR, UserRole.WORKER],
        },
      },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    });

    return users.map((user) => ({
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
    }));
  }

  async findByEmail(email: string) {
    return db.user.findUnique({
      where: { email },
      select: {
        id: true,
        factoryId: true,
      },
    });
  }

  async findById(factoryId: string, userId: string) {
    return db.user.findFirst({
      where: {
        id: userId,
        factoryId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
      },
    });
  }

  async countActiveOwners(factoryId: string) {
    return db.user.count({
      where: {
        factoryId,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async create(factoryId: string, input: CreateManagedUserInput & { passwordHash: string }) {
    const user = await db.user.create({
      data: {
        factoryId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        role: input.role,
        status: UserStatus.ACTIVE,
        passwordHash: input.passwordHash,
      },
      select: userListItemSelect,
    });

    return toUserListItem(user);
  }

  async update(_factoryId: string, input: UpdateManagedUserInput) {
    const user = await db.user.update({
      where: {
        id: input.userId,
      },
      data: {
        role: input.role,
        status: input.status,
      },
      select: userListItemSelect,
    });

    return toUserListItem(user);
  }

  async updatePassword(
    _factoryId: string,
    input: ResetManagedUserPasswordInput & {
      passwordHash: string;
      nextStatus?: UserStatus;
    }
  ) {
    return db.user.update({
      where: {
        id: input.userId,
      },
      data: {
        passwordHash: input.passwordHash,
        status: input.nextStatus,
      },
      select: {
        id: true,
      },
    });
  }
}
