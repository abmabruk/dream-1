import "server-only";

import type { UserRole } from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import { hasPermission } from "@/modules/auth/roles";

import {
  CreateVendorInput,
  UpdateVendorInput,
  VendorContactInput,
  type VendorContactDetail,
  type VendorDetail,
  type VendorListItem,
  type VendorPerformance,
} from "./vendor.schemas";
import { VendorRepository } from "./vendor.repository";

type Actor = { userId: string; role: UserRole };

export class VendorService {
  constructor(private readonly repository = new VendorRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "vendors:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض الموردين.");
    }
  }

  private assertManage(role: UserRole) {
    if (!hasPermission(role, "vendors:manage")) {
      throw new HttpError(403, "ليس لديك صلاحية إدارة الموردين.");
    }
  }

  async list(
    factoryId: string,
    role: UserRole,
    opts?: { search?: string; deletedFilter?: "active" | "deleted" | "all" },
  ): Promise<VendorListItem[]> {
    this.assertView(role);
    return this.repository.list(factoryId, opts);
  }

  async getById(
    factoryId: string,
    role: UserRole,
    vendorId: string,
  ): Promise<VendorDetail> {
    this.assertView(role);
    return this.repository.getById(factoryId, vendorId);
  }

  async create(
    factoryId: string,
    actor: Actor,
    input: unknown,
  ): Promise<VendorDetail> {
    this.assertManage(actor.role);
    const parsed = CreateVendorInput.parse(input);
    return this.repository.create(factoryId, actor.userId, parsed);
  }

  async update(
    factoryId: string,
    actor: Actor,
    vendorId: string,
    input: unknown,
  ): Promise<VendorDetail> {
    this.assertManage(actor.role);
    const parsed = UpdateVendorInput.parse(input);
    return this.repository.update(factoryId, vendorId, parsed);
  }

  async softDelete(
    factoryId: string,
    actor: Actor,
    vendorId: string,
  ): Promise<{ id: string }> {
    this.assertManage(actor.role);
    return this.repository.softDelete(factoryId, vendorId);
  }

  async restore(
    factoryId: string,
    actor: Actor,
    vendorId: string,
  ): Promise<VendorDetail> {
    this.assertManage(actor.role);
    return this.repository.restore(factoryId, vendorId);
  }

  // ──────────────────────── Contacts ────────────────────────
  async addContact(
    factoryId: string,
    actor: Actor,
    vendorId: string,
    input: unknown,
  ): Promise<VendorContactDetail> {
    this.assertManage(actor.role);
    const parsed = VendorContactInput.parse(input);
    return this.repository.addContact(factoryId, vendorId, parsed);
  }

  async updateContact(
    factoryId: string,
    actor: Actor,
    vendorId: string,
    contactId: string,
    input: unknown,
  ): Promise<VendorContactDetail> {
    this.assertManage(actor.role);
    const parsed = VendorContactInput.parse(input);
    return this.repository.updateContact(factoryId, vendorId, contactId, parsed);
  }

  async deleteContact(
    factoryId: string,
    actor: Actor,
    vendorId: string,
    contactId: string,
  ): Promise<{ id: string }> {
    this.assertManage(actor.role);
    return this.repository.deleteContact(factoryId, vendorId, contactId);
  }

  // ──────────────────────── Performance ────────────────────────
  async getPerformance(
    factoryId: string,
    role: UserRole,
    vendorId: string,
  ): Promise<VendorPerformance> {
    this.assertView(role);
    return this.repository.getPerformance(factoryId, vendorId);
  }
}
