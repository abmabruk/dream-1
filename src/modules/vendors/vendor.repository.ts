import "server-only";

import { Prisma } from "@prisma/client";

import { db, type PrismaTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import {
  emptyToNull,
  normalizeVendorName,
  type CreateVendorInputType,
  type UpdateVendorInputType,
  type VendorContactDetail,
  type VendorContactInputType,
  type VendorDetail,
  type VendorListItem,
  type VendorPerformance,
} from "./vendor.schemas";

// ────────────────────────────────────────────────────────────
// Row types — until prisma generate definitely surfaces these
// the structural shape is what we use at call sites.
// ────────────────────────────────────────────────────────────
type VendorRow = {
  id: string;
  factoryId: string;
  name: string;
  normalizedName: string;
  code: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  paymentTermsDays: number | null;
  preferredCurrency: string | null;
  notes: string | null;
  deletedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VendorContactRow = {
  id: string;
  vendorId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VendorWithRelations = VendorRow & {
  contacts: VendorContactRow[];
  _count?: { contacts: number };
};

interface VendorDelegate {
  create(args: {
    data: Omit<VendorRow, "id" | "createdAt" | "updatedAt"> & {
      contacts?: { create: Array<Omit<VendorContactRow, "id" | "vendorId" | "createdAt" | "updatedAt">> };
    };
    include?: { contacts?: boolean; _count?: { select?: { contacts?: boolean } } };
  }): Promise<VendorWithRelations>;
  findFirst(args: {
    where: Record<string, unknown>;
    include?: { contacts?: boolean | { orderBy?: Record<string, "asc" | "desc"> }; _count?: { select?: { contacts?: boolean } } };
  }): Promise<VendorWithRelations | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: { contacts?: boolean; _count?: { select?: { contacts?: boolean } } };
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
    take?: number;
  }): Promise<VendorWithRelations[]>;
  update(args: {
    where: { id: string };
    data: Partial<VendorRow>;
    include?: { contacts?: boolean; _count?: { select?: { contacts?: boolean } } };
  }): Promise<VendorWithRelations>;
}

interface VendorContactDelegate {
  create(args: { data: Omit<VendorContactRow, "id" | "createdAt" | "updatedAt"> }): Promise<VendorContactRow>;
  update(args: { where: { id: string }; data: Partial<VendorContactRow> }): Promise<VendorContactRow>;
  updateMany(args: { where: Record<string, unknown>; data: Partial<VendorContactRow> }): Promise<{ count: number }>;
  delete(args: { where: { id: string } }): Promise<VendorContactRow>;
  findFirst(args: { where: Record<string, unknown> }): Promise<VendorContactRow | null>;
}

interface ProjectCostAggregateDelegate {
  aggregate(args: {
    where: Record<string, unknown>;
    _sum?: { amount?: boolean };
    _count?: { _all?: boolean } | true;
    _max?: { incurredAt?: boolean };
  }): Promise<{
    _sum: { amount: Prisma.Decimal | null };
    _count: { _all: number } | number;
    _max: { incurredAt: Date | null };
  }>;
  groupBy(args: {
    by: Array<"vendorId">;
    where: Record<string, unknown>;
    _max?: { incurredAt?: boolean };
  }): Promise<Array<{ vendorId: string | null; _max: { incurredAt: Date | null } }>>;
}

interface DbWithVendor {
  vendor: VendorDelegate;
  vendorContact: VendorContactDelegate;
  projectCost: ProjectCostAggregateDelegate;
}

interface TxWithVendor {
  vendor: VendorDelegate;
  vendorContact: VendorContactDelegate;
}

function isP2002(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function mapContact(c: VendorContactRow): VendorContactDetail {
  return {
    id: c.id,
    vendorId: c.vendorId,
    name: c.name,
    role: c.role,
    email: c.email,
    phone: c.phone,
    isPrimary: c.isPrimary,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function mapVendorListItem(
  v: VendorWithRelations,
  lastUsedAt: Date | null,
): VendorListItem {
  return {
    id: v.id,
    factoryId: v.factoryId,
    name: v.name,
    normalizedName: v.normalizedName,
    code: v.code,
    taxNumber: v.taxNumber,
    email: v.email,
    phone: v.phone,
    city: v.city,
    deletedAt: v.deletedAt ? v.deletedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    contactCount: v._count?.contacts ?? v.contacts?.length ?? 0,
    lastUsedAt: lastUsedAt ? lastUsedAt.toISOString() : null,
  };
}

function mapVendorDetail(
  v: VendorWithRelations,
  lastUsedAt: Date | null,
): VendorDetail {
  return {
    ...mapVendorListItem(v, lastUsedAt),
    website: v.website,
    address: v.address,
    paymentTermsDays: v.paymentTermsDays,
    preferredCurrency: v.preferredCurrency,
    notes: v.notes,
    contacts: (v.contacts ?? []).map(mapContact),
  };
}

function buildContactCreateData(
  c: VendorContactInputType,
): Omit<VendorContactRow, "id" | "vendorId" | "createdAt" | "updatedAt"> {
  return {
    name: c.name,
    role: emptyToNull(c.role),
    email: emptyToNull(c.email),
    phone: emptyToNull(c.phone),
    isPrimary: c.isPrimary ?? false,
  };
}

export class VendorRepository {
  async list(
    factoryId: string,
    opts?: { search?: string; deletedFilter?: "active" | "deleted" | "all" },
  ): Promise<VendorListItem[]> {
    const dbv = db as unknown as DbWithVendor;
    const where: Record<string, unknown> = { factoryId };
    const filter = opts?.deletedFilter ?? "active";
    if (filter === "active") where.deletedAt = null;
    else if (filter === "deleted") where.deletedAt = { not: null };

    const search = opts?.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { taxNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const vendors = await dbv.vendor.findMany({
      where,
      include: { _count: { select: { contacts: true } } },
      orderBy: [{ name: "asc" }],
      take: 500,
    });

    if (vendors.length === 0) return [];

    const lastUsedMap = await this.lastUsedMap(
      factoryId,
      vendors.map((v) => v.id),
    );

    return vendors.map((v) => mapVendorListItem(v, lastUsedMap.get(v.id) ?? null));
  }

  async getById(factoryId: string, vendorId: string): Promise<VendorDetail> {
    const dbv = db as unknown as DbWithVendor;
    const v = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        _count: { select: { contacts: true } },
      },
    });
    if (!v) {
      throw new HttpError(404, "المورّد غير موجود.");
    }
    const lastUsedMap = await this.lastUsedMap(factoryId, [v.id]);
    return mapVendorDetail(v, lastUsedMap.get(v.id) ?? null);
  }

  async create(
    factoryId: string,
    actorUserId: string,
    input: CreateVendorInputType,
  ): Promise<VendorDetail> {
    const normalizedName = normalizeVendorName(input.name);
    try {
      return await db.$transaction(async (tx) => {
        const txv = tx as unknown as TxWithVendor;
        const created = await txv.vendor.create({
          data: {
            factoryId,
            name: input.name.trim(),
            normalizedName,
            code: emptyToNull(input.code),
            taxNumber: emptyToNull(input.taxNumber),
            email: emptyToNull(input.email),
            phone: emptyToNull(input.phone),
            website: emptyToNull(input.website),
            address: emptyToNull(input.address),
            city: emptyToNull(input.city),
            paymentTermsDays: input.paymentTermsDays ?? null,
            preferredCurrency: emptyToNull(input.preferredCurrency),
            notes: emptyToNull(input.notes),
            deletedAt: null,
            createdById: actorUserId,
            ...(input.contacts && input.contacts.length > 0
              ? {
                  contacts: {
                    create: input.contacts.map(buildContactCreateData),
                  },
                }
              : {}),
          } as never,
          include: {
            contacts: true,
            _count: { select: { contacts: true } },
          },
        });
        return mapVendorDetail(created, null);
      });
    } catch (err) {
      if (isP2002(err)) {
        throw new HttpError(409, "اسم المورّد موجود مسبقاً.");
      }
      throw err;
    }
  }

  async update(
    factoryId: string,
    vendorId: string,
    input: UpdateVendorInputType,
  ): Promise<VendorDetail> {
    const dbv = db as unknown as DbWithVendor;
    const existing = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!existing) {
      throw new HttpError(404, "المورّد غير موجود.");
    }

    const data: Partial<VendorRow> = {};
    if (input.name !== undefined) {
      data.name = input.name.trim();
      data.normalizedName = normalizeVendorName(input.name);
    }
    if (input.code !== undefined) data.code = emptyToNull(input.code);
    if (input.taxNumber !== undefined)
      data.taxNumber = emptyToNull(input.taxNumber);
    if (input.email !== undefined) data.email = emptyToNull(input.email);
    if (input.phone !== undefined) data.phone = emptyToNull(input.phone);
    if (input.website !== undefined) data.website = emptyToNull(input.website);
    if (input.address !== undefined) data.address = emptyToNull(input.address);
    if (input.city !== undefined) data.city = emptyToNull(input.city);
    if (input.paymentTermsDays !== undefined)
      data.paymentTermsDays = input.paymentTermsDays ?? null;
    if (input.preferredCurrency !== undefined)
      data.preferredCurrency = emptyToNull(input.preferredCurrency);
    if (input.notes !== undefined) data.notes = emptyToNull(input.notes);

    try {
      const updated = await dbv.vendor.update({
        where: { id: vendorId },
        data,
        include: {
          contacts: true,
          _count: { select: { contacts: true } },
        },
      });
      const lastUsedMap = await this.lastUsedMap(factoryId, [updated.id]);
      return mapVendorDetail(updated, lastUsedMap.get(updated.id) ?? null);
    } catch (err) {
      if (isP2002(err)) {
        throw new HttpError(409, "اسم المورّد موجود مسبقاً.");
      }
      throw err;
    }
  }

  async softDelete(factoryId: string, vendorId: string): Promise<{ id: string }> {
    const dbv = db as unknown as DbWithVendor;
    const existing = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!existing) {
      throw new HttpError(404, "المورّد غير موجود.");
    }
    await dbv.vendor.update({
      where: { id: vendorId },
      data: { deletedAt: new Date() },
    });
    return { id: vendorId };
  }

  async restore(factoryId: string, vendorId: string): Promise<VendorDetail> {
    const dbv = db as unknown as DbWithVendor;
    const existing = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!existing) {
      throw new HttpError(404, "المورّد غير موجود.");
    }
    await dbv.vendor.update({
      where: { id: vendorId },
      data: { deletedAt: null },
    });
    return this.getById(factoryId, vendorId);
  }

  // ──────────────────────── Contacts ────────────────────────
  async addContact(
    factoryId: string,
    vendorId: string,
    input: VendorContactInputType,
  ): Promise<VendorContactDetail> {
    const dbv = db as unknown as DbWithVendor;
    const vendor = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!vendor) {
      throw new HttpError(404, "المورّد غير موجود.");
    }

    return db.$transaction(async (tx) => {
      const txv = tx as unknown as TxWithVendor;
      if (input.isPrimary) {
        await txv.vendorContact.updateMany({
          where: { vendorId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      const created = await txv.vendorContact.create({
        data: { vendorId, ...buildContactCreateData(input) },
      });
      return mapContact(created);
    });
  }

  async updateContact(
    factoryId: string,
    vendorId: string,
    contactId: string,
    input: VendorContactInputType,
  ): Promise<VendorContactDetail> {
    const dbv = db as unknown as DbWithVendor;
    const vendor = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!vendor) {
      throw new HttpError(404, "المورّد غير موجود.");
    }
    const existing = await dbv.vendorContact.findFirst({
      where: { id: contactId, vendorId },
    });
    if (!existing) {
      throw new HttpError(404, "جهة الاتصال غير موجودة.");
    }

    return db.$transaction(async (tx) => {
      const txv = tx as unknown as TxWithVendor;
      if (input.isPrimary) {
        await txv.vendorContact.updateMany({
          where: { vendorId, isPrimary: true, NOT: { id: contactId } },
          data: { isPrimary: false },
        });
      }
      const updated = await txv.vendorContact.update({
        where: { id: contactId },
        data: buildContactCreateData(input),
      });
      return mapContact(updated);
    });
  }

  async deleteContact(
    factoryId: string,
    vendorId: string,
    contactId: string,
  ): Promise<{ id: string }> {
    const dbv = db as unknown as DbWithVendor;
    const vendor = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!vendor) {
      throw new HttpError(404, "المورّد غير موجود.");
    }
    const existing = await dbv.vendorContact.findFirst({
      where: { id: contactId, vendorId },
    });
    if (!existing) {
      throw new HttpError(404, "جهة الاتصال غير موجودة.");
    }
    await dbv.vendorContact.delete({ where: { id: contactId } });
    return { id: contactId };
  }

  // ──────────────────────── Performance ────────────────────────
  async getPerformance(
    factoryId: string,
    vendorId: string,
  ): Promise<VendorPerformance> {
    const dbv = db as unknown as DbWithVendor;
    const vendor = await dbv.vendor.findFirst({
      where: { id: vendorId, factoryId },
    });
    if (!vendor) {
      throw new HttpError(404, "المورّد غير موجود.");
    }

    try {
      const agg = await dbv.projectCost.aggregate({
        where: { factoryId, vendorId },
        _sum: { amount: true },
        _count: { _all: true },
        _max: { incurredAt: true },
      });
      const total = agg._sum.amount ?? new Prisma.Decimal(0);
      const count =
        typeof agg._count === "number" ? agg._count : agg._count?._all ?? 0;
      return {
        totalSpend: new Prisma.Decimal(total).toFixed(2),
        costCount: count,
        lastUsedAt: agg._max.incurredAt ? agg._max.incurredAt.toISOString() : null,
      };
    } catch {
      return { totalSpend: "0.00", costCount: 0, lastUsedAt: null };
    }
  }

  // Private — last used per vendor (for list/detail decoration)
  private async lastUsedMap(
    factoryId: string,
    vendorIds: string[],
  ): Promise<Map<string, Date | null>> {
    const map = new Map<string, Date | null>();
    if (vendorIds.length === 0) return map;
    try {
      const dbv = db as unknown as DbWithVendor;
      const groups = await dbv.projectCost.groupBy({
        by: ["vendorId"],
        where: { factoryId, vendorId: { in: vendorIds } },
        _max: { incurredAt: true },
      });
      for (const g of groups) {
        if (g.vendorId) map.set(g.vendorId, g._max.incurredAt ?? null);
      }
    } catch {
      // Old schemas may not have vendorId on ProjectCost yet; ignore.
    }
    return map;
  }
}

// Silence unused — PrismaTransaction is exported for parity with other repos.
export type { PrismaTransaction };
