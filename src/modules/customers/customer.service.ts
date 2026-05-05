import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/modules/auth/password";
import type { UserRole } from "@/modules/auth/roles";

import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerDetail,
  type UpdateCustomerInput,
} from "./customer.schemas";
import {
  CustomerRepository,
  type CustomerListPagination,
} from "./customer.repository";

export type InviteCustomerResult = {
  userId: string;
  email: string;
  tempPassword: string | null;
  emailSent: boolean;
  alreadyLinked: boolean;
};

function generateTempPassword(): string {
  // 12 chars, URL-safe-ish; readable when displayed in a banner.
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

export class CustomerService {
  constructor(private readonly repository = new CustomerRepository()) {}

  async list(factoryId: string, pagination: CustomerListPagination = {}) {
    return this.repository.listByFactory(factoryId, pagination);
  }

  async exists(factoryId: string, customerId: string) {
    return this.repository.exists(factoryId, customerId);
  }

  async create(factoryId: string, input: CreateCustomerInput) {
    const parsed = createCustomerSchema.parse(input);
    return this.repository.create(factoryId, parsed);
  }

  async getById(
    factoryId: string,
    customerId: string,
  ): Promise<CustomerDetail> {
    return this.repository.getById(factoryId, customerId);
  }

  async update(
    factoryId: string,
    customerId: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDetail> {
    const parsed = updateCustomerSchema.parse(input);
    return this.repository.update(factoryId, customerId, parsed);
  }

  async delete(factoryId: string, customerId: string): Promise<{ id: string }> {
    return this.repository.hardDelete(factoryId, customerId);
  }

  /**
   * Link an existing User account to a Customer. Throws if the customer is
   * already linked to a different user, or the user is already linked to
   * another customer.
   */
  async linkUser(
    factoryId: string,
    customerId: string,
    userId: string,
  ): Promise<void> {
    const customer = await db.customer.findFirst({
      where: { id: customerId, factoryId },
      select: { id: true, userId: true },
    });
    if (!customer) {
      throw new HttpError(404, "العميل غير موجود.");
    }
    if (customer.userId && customer.userId !== userId) {
      throw new HttpError(409, "هذا العميل مرتبط بحساب آخر بالفعل.");
    }

    const otherCustomerForUser = await db.customer.findFirst({
      where: { userId, NOT: { id: customerId } },
      select: { id: true },
    });
    if (otherCustomerForUser) {
      throw new HttpError(409, "هذا الحساب مرتبط بعميل آخر بالفعل.");
    }

    await db.customer.update({
      where: { id: customerId },
      data: { userId },
    });
  }

  /**
   * Create a CUSTOMER User for the given customer (or reset password if
   * already linked) and return a temp password. Email sending is OUT of
   * scope for this phase — temp password is returned in dev so the
   * inviting staff member can deliver it manually.
   *
   * Caller is responsible for permission gating (`customers:manage`).
   */
  async inviteCustomer(
    factoryId: string,
    customerId: string,
    actor: { userId: string; role: UserRole },
  ): Promise<InviteCustomerResult> {
    const customer = await db.customer.findFirst({
      where: { id: customerId, factoryId },
      select: {
        id: true,
        name: true,
        email: true,
        userId: true,
      },
    });
    if (!customer) {
      throw new HttpError(404, "العميل غير موجود.");
    }
    const email = customer.email?.toLowerCase().trim();
    if (!email) {
      throw new HttpError(
        422,
        "يجب تسجيل بريد إلكتروني للعميل قبل دعوته إلى البوابة.",
      );
    }

    // If already linked, reset the password and return.
    if (customer.userId) {
      const existing = await db.user.findUnique({
        where: { id: customer.userId },
        select: { id: true, email: true, role: true, status: true },
      });
      if (existing) {
        const tempPassword = generateTempPassword();
        await db.user.update({
          where: { id: existing.id },
          data: {
            passwordHash: hashPassword(tempPassword),
            status: "ACTIVE",
          },
        });
        await recordAudit({
          factoryId,
          actorUserId: actor.userId,
          actorRoleSnapshot: actor.role,
          action: "CUSTOMER_INVITE_RESENT",
          entityType: "Customer",
          entityId: customer.id,
          metadata: { userId: existing.id, email: existing.email },
        });
        return {
          userId: existing.id,
          email: existing.email,
          tempPassword:
            process.env.NODE_ENV === "production" ? null : tempPassword,
          emailSent: false,
          alreadyLinked: true,
        };
      }
      // Stale link — clear and recreate below.
      await db.customer.update({
        where: { id: customerId },
        data: { userId: null },
      });
    }

    // Reject if a user already exists with this email (could be staff).
    const collision = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (collision) {
      throw new HttpError(409, "يوجد مستخدم بهذا البريد الإلكتروني بالفعل.");
    }

    const tempPassword = generateTempPassword();

    // Best-effort split of name into first/last for the User table.
    const trimmedName = customer.name.trim();
    const spaceIdx = trimmedName.indexOf(" ");
    const firstName =
      spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
    const lastName =
      spaceIdx === -1 ? "" : trimmedName.slice(spaceIdx + 1).trim();

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          factoryId,
          email,
          firstName: firstName || trimmedName,
          lastName: lastName || "—",
          role: "CUSTOMER",
          status: "ACTIVE",
          passwordHash: hashPassword(tempPassword),
        },
        select: { id: true, email: true },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: { userId: created.id },
      });
      return created;
    });

    await recordAudit({
      factoryId,
      actorUserId: actor.userId,
      actorRoleSnapshot: actor.role,
      action: "CUSTOMER_INVITED",
      entityType: "Customer",
      entityId: customer.id,
      metadata: { userId: user.id, email: user.email },
    });

    // Email sending is OUT of scope for this phase. In production this
    // would dispatch a transactional email; for now, surface a warning.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[customer-invite] Email service not wired — temp password was generated but not delivered",
        { customerId: customer.id, email: user.email },
      );
    }

    return {
      userId: user.id,
      email: user.email,
      tempPassword: process.env.NODE_ENV === "production" ? null : tempPassword,
      emailSent: false,
      alreadyLinked: false,
    };
  }
}
