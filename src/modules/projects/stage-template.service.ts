import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { USER_ROLES } from "@/modules/auth/roles";

export const stageTemplateOwnerRoleSchema = z.enum(USER_ROLES).nullable();

export const createStageTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  expectedDays: z.number().int().min(0).max(3650).nullable().optional(),
  ownerRole: stageTemplateOwnerRoleSchema.optional(),
  isOptional: z.boolean().optional(),
  requiresDepositAttestation: z.boolean().optional(),
});

export const updateStageTemplateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  expectedDays: z.number().int().min(0).max(3650).nullable().optional(),
  ownerRole: stageTemplateOwnerRoleSchema.optional(),
  isOptional: z.boolean().optional(),
  isActive: z.boolean().optional(),
  requiresDepositAttestation: z.boolean().optional(),
});

export const reorderStageTemplatesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export type StageTemplateItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerRole: string | null;
  sortOrder: number;
  isOptional: boolean;
  requiresDepositAttestation: boolean;
  expectedDays: number | null;
  isActive: boolean;
  activeInstanceCount: number;
};

const slugify = (input: string) => {
  // Strip diacritics, lowercase, replace non-alphanumerics with -.
  const ascii = input
    .normalize("NFKD")
    .replace(/[ً-ْٰ]/g, "");
  return ascii
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || `stage-${Date.now().toString(36).slice(-6)}`;
};

type DbStageTemplate = {
  projectStage: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      ownerRole: string | null;
      sortOrder: number;
      isOptional: boolean;
      requiresDepositAttestation: boolean;
      expectedDays: number | null;
      isActive: boolean;
      _count?: { instances: number };
    }>>;
    findFirst: (args: unknown) => Promise<{
      id: string;
      slug: string;
      sortOrder: number;
    } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<{ id: string }>;
  };
  projectStageInstance: {
    count: (args: unknown) => Promise<number>;
  };
};

export class StageTemplateService {
  private get dbAny() {
    return db as never as DbStageTemplate;
  }

  async listForFactory(factoryId: string): Promise<StageTemplateItem[]> {
    const rows = await this.dbAny.projectStage.findMany({
      where: { factoryId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            instances: {
              where: {
                status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      ownerRole: row.ownerRole,
      sortOrder: row.sortOrder,
      isOptional: row.isOptional,
      requiresDepositAttestation: row.requiresDepositAttestation,
      expectedDays: row.expectedDays,
      isActive: row.isActive,
      activeInstanceCount: row._count?.instances ?? 0,
    }));
  }

  async create(factoryId: string, input: unknown): Promise<StageTemplateItem> {
    const parsed = createStageTemplateSchema.parse(input);

    // Determine next sortOrder.
    const last = await this.dbAny.projectStage.findFirst({
      where: { factoryId },
      orderBy: { sortOrder: "desc" },
    });
    const nextOrder = (last?.sortOrder ?? -1) + 1;

    // Generate a unique slug.
    const baseSlug = slugify(parsed.name);
    let candidate = baseSlug;
    let suffix = 2;
    while (
      await this.dbAny.projectStage.findFirst({
        where: { factoryId, slug: candidate },
      })
    ) {
      candidate = `${baseSlug}-${suffix++}`;
      if (suffix > 50) {
        candidate = `${baseSlug}-${Date.now().toString(36).slice(-6)}`;
        break;
      }
    }

    await this.dbAny.projectStage.create({
      data: {
        factoryId,
        slug: candidate,
        name: parsed.name,
        sortOrder: nextOrder,
        ownerRole: parsed.ownerRole ?? null,
        expectedDays: parsed.expectedDays ?? null,
        isOptional: parsed.isOptional ?? false,
        requiresDepositAttestation: parsed.requiresDepositAttestation ?? false,
        isActive: true,
      },
    });

    const list = await this.listForFactory(factoryId);
    const created = list.find((row) => row.slug === candidate);
    if (!created) {
      throw new HttpError(500, "Stage was created but could not be re-read.");
    }
    return created;
  }

  async update(factoryId: string, stageId: string, input: unknown) {
    const parsed = updateStageTemplateSchema.parse(input);

    const existing = await this.dbAny.projectStage.findFirst({
      where: { id: stageId, factoryId },
    });
    if (!existing) {
      throw new HttpError(404, "Stage template not found.");
    }

    const data: Record<string, unknown> = {};
    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.expectedDays !== undefined) data.expectedDays = parsed.expectedDays;
    if (parsed.ownerRole !== undefined) data.ownerRole = parsed.ownerRole;
    if (parsed.isOptional !== undefined) data.isOptional = parsed.isOptional;
    if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
    if (parsed.requiresDepositAttestation !== undefined)
      data.requiresDepositAttestation = parsed.requiresDepositAttestation;

    await this.dbAny.projectStage.update({
      where: { id: stageId },
      data,
    });

    const list = await this.listForFactory(factoryId);
    const updated = list.find((row) => row.id === stageId);
    if (!updated) {
      throw new HttpError(404, "Stage template not found after update.");
    }
    return updated;
  }

  async reorder(factoryId: string, input: unknown) {
    const parsed = reorderStageTemplatesSchema.parse(input);

    const list = await this.listForFactory(factoryId);
    const factoryIds = new Set(list.map((row) => row.id));
    for (const id of parsed.orderedIds) {
      if (!factoryIds.has(id)) {
        throw new HttpError(400, "Stage template does not belong to this factory.");
      }
    }

    await db.$transaction(async (tx) => {
      const txAny = tx as never as DbStageTemplate;
      for (let index = 0; index < parsed.orderedIds.length; index++) {
        await txAny.projectStage.update({
          where: { id: parsed.orderedIds[index] },
          data: { sortOrder: index },
        });
      }
    });

    return { reordered: parsed.orderedIds.length };
  }
}
