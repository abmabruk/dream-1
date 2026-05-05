import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";

import type {
  CreateCustomerInput,
  CustomerDetail,
  CustomerListItem,
  UpdateCustomerInput,
} from "./customer.schemas";

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export interface CustomerListPagination {
  take?: number;
  skip?: number;
}

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

function clampTake(take: number | undefined): number {
  if (take === undefined) return DEFAULT_TAKE;
  if (!Number.isFinite(take) || take <= 0) return DEFAULT_TAKE;
  return Math.min(Math.floor(take), MAX_TAKE);
}

function clampSkip(skip: number | undefined): number {
  if (skip === undefined) return 0;
  if (!Number.isFinite(skip) || skip < 0) return 0;
  return Math.floor(skip);
}

export class CustomerRepository {
  async listByFactory(
    factoryId: string,
    pagination: CustomerListPagination = {},
  ): Promise<CustomerListItem[]> {
    const customers = await db.customer.findMany({
      where: { factoryId },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: clampTake(pagination.take),
      skip: clampSkip(pagination.skip),
    });

    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      district: customer.district,
      notes: customer.notes,
      orderCount: customer._count.orders,
      createdAt: customer.createdAt.toISOString(),
    }));
  }

  async exists(factoryId: string, customerId: string) {
    const count = await db.customer.count({
      where: {
        id: customerId,
        factoryId,
      },
    });

    return count > 0;
  }

  async create(factoryId: string, input: CreateCustomerInput) {
    return db.customer.create({
      data: {
        factoryId,
        name: input.name,
        email: emptyToNull(input.email),
        phone: emptyToNull(input.phone),
        city: emptyToNull(input.city),
        district: emptyToNull(input.district),
        notes: emptyToNull(input.notes),
      },
    });
  }

  async getById(
    factoryId: string,
    customerId: string,
  ): Promise<CustomerDetail> {
    const customer = await db.customer.findFirst({
      where: { id: customerId, factoryId },
      include: { _count: { select: { orders: true } } },
    });
    if (!customer) {
      throw new HttpError(404, "العميل غير موجود.");
    }
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      district: customer.district,
      notes: customer.notes,
      taxNumber: customer.taxNumber,
      address: customer.address,
      orderCount: customer._count.orders,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  async update(
    factoryId: string,
    customerId: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDetail> {
    const existing = await db.customer.findFirst({
      where: { id: customerId, factoryId },
    });
    if (!existing) {
      throw new HttpError(404, "العميل غير موجود.");
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = emptyToNull(input.email);
    if (input.phone !== undefined) data.phone = emptyToNull(input.phone);
    if (input.city !== undefined) data.city = emptyToNull(input.city);
    if (input.district !== undefined)
      data.district = emptyToNull(input.district);
    if (input.notes !== undefined) data.notes = emptyToNull(input.notes);

    await db.customer.update({
      where: { id: customerId },
      data,
    });

    return this.getById(factoryId, customerId);
  }

  async hardDelete(
    factoryId: string,
    customerId: string,
  ): Promise<{ id: string }> {
    const existing = await db.customer.findFirst({
      where: { id: customerId, factoryId },
      include: {
        _count: {
          select: { orders: true, invoices: true, payments: true },
        },
      },
    });
    if (!existing) {
      throw new HttpError(404, "العميل غير موجود.");
    }

    const refs =
      existing._count.orders +
      existing._count.invoices +
      existing._count.payments;
    if (refs > 0) {
      throw new HttpError(
        409,
        "لا يمكن حذف العميل لوجود طلبات أو فواتير أو مدفوعات مرتبطة به.",
      );
    }

    try {
      await db.customer.delete({ where: { id: customerId } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        throw new HttpError(409, "لا يمكن حذف العميل لوجود سجلات مرتبطة به.");
      }
      throw err;
    }
    return { id: customerId };
  }
}
