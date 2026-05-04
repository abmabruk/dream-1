import "server-only";

import type { UserRole } from "@prisma/client";

import { HttpError } from "@/lib/http/http-error";
import { hasPermission } from "@/modules/auth/roles";

import {
  CreateProductInput,
  UpdateProductInput,
  VariantInput,
  type ListProductOptions,
  type ProductDetail,
  type ProductListItem,
  type ProductPickerItem,
  type VariantDetail,
} from "./product.schemas";
import { ProductRepository } from "./product.repository";

export class ProductService {
  constructor(private readonly repository = new ProductRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "products:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض المنتجات.");
    }
  }

  private assertManage(role: UserRole) {
    if (!hasPermission(role, "products:manage")) {
      throw new HttpError(403, "ليس لديك صلاحية إدارة المنتجات.");
    }
  }

  async list(
    factoryId: string,
    role: UserRole,
    opts?: ListProductOptions,
  ): Promise<ProductListItem[]> {
    this.assertView(role);
    return this.repository.list(factoryId, opts);
  }

  async getById(
    factoryId: string,
    role: UserRole,
    productId: string,
  ): Promise<ProductDetail> {
    this.assertView(role);
    const found = await this.repository.getById(factoryId, productId);
    if (!found) throw new HttpError(404, "المنتج غير موجود.");
    return found;
  }

  async create(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    input: unknown,
  ): Promise<ProductDetail> {
    this.assertManage(actor.role);
    const parsed = CreateProductInput.parse(input);
    return this.repository.create(factoryId, actor.userId, parsed);
  }

  async update(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    productId: string,
    input: unknown,
  ): Promise<ProductDetail> {
    this.assertManage(actor.role);
    const parsed = UpdateProductInput.parse(input);
    return this.repository.update(factoryId, productId, parsed);
  }

  async softDelete(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    productId: string,
  ): Promise<{ id: string }> {
    this.assertManage(actor.role);
    return this.repository.softDelete(factoryId, productId);
  }

  async restore(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    productId: string,
  ): Promise<ProductDetail> {
    this.assertManage(actor.role);
    return this.repository.restore(factoryId, productId);
  }

  // ────────────────────────────────────────────────────────────
  // Variants
  // ────────────────────────────────────────────────────────────
  async addVariant(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    productId: string,
    input: unknown,
  ): Promise<VariantDetail> {
    this.assertManage(actor.role);
    const parsed = VariantInput.parse(input);
    return this.repository.addVariant(factoryId, productId, parsed);
  }

  async updateVariant(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    productId: string,
    variantId: string,
    input: unknown,
  ): Promise<VariantDetail> {
    this.assertManage(actor.role);
    const parsed = VariantInput.parse(input);
    return this.repository.updateVariant(
      factoryId,
      productId,
      variantId,
      parsed,
    );
  }

  async deleteVariant(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    productId: string,
    variantId: string,
  ): Promise<{ id: string }> {
    this.assertManage(actor.role);
    return this.repository.deleteVariant(factoryId, productId, variantId);
  }

  // ────────────────────────────────────────────────────────────
  // Picker convenience for QuoteForm
  // ────────────────────────────────────────────────────────────
  async searchForPicker(
    factoryId: string,
    role: UserRole,
    query: string,
    limit = 20,
  ): Promise<ProductPickerItem[]> {
    this.assertView(role);
    return this.repository.searchForPicker(factoryId, query, limit);
  }
}
