import "server-only";

import { db, type PrismaTransaction } from "@/lib/db";
import type { AttachmentListItem } from "./attachment.schemas";

/**
 * Until `prisma generate` runs against the new schema, the auto-generated
 * client lacks `db.taskAttachment`. We declare the shape we need and
 * typecast at the call site (mirrors the Phase 5 cost-repo pattern).
 */
type AttachmentRow = {
  id: string;
  factoryId: string;
  taskId: string;
  filename: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string | null;
  createdAt: Date;
};

type AttachmentWithUploader = AttachmentRow & {
  uploadedBy: { firstName: string; lastName: string } | null;
  task?: { projectId: string; project: { code: string; name: string } } | null;
};

interface AttachmentDelegate {
  create(args: {
    data: Omit<AttachmentRow, "id" | "createdAt">;
    include?: { uploadedBy?: boolean; task?: unknown };
  }): Promise<AttachmentWithUploader>;
  findFirst(args: {
    where: { id?: string; factoryId?: string; taskId?: string };
    include?: { uploadedBy?: boolean; task?: unknown };
  }): Promise<AttachmentWithUploader | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: { uploadedBy?: boolean; task?: unknown };
    orderBy?: Record<string, "asc" | "desc"> | { createdAt?: "asc" | "desc" }[];
    take?: number;
  }): Promise<AttachmentWithUploader[]>;
  delete(args: { where: { id: string } }): Promise<AttachmentRow>;
}

interface DbWithAttachment {
  taskAttachment: AttachmentDelegate;
}

interface TxWithAttachment {
  taskAttachment: AttachmentDelegate;
  projectTask: PrismaTransaction["projectTask"];
  projectActivity: PrismaTransaction["projectActivity"];
}

function displayName(user: { firstName: string; lastName: string } | null | undefined) {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim();
}

export function mapAttachment(a: AttachmentWithUploader): AttachmentListItem {
  return {
    id: a.id,
    taskId: a.taskId,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploadedById: a.uploadedById,
    uploadedByName: displayName(a.uploadedBy),
    createdAt: a.createdAt.toISOString(),
    url: `/api/v1/attachments/${a.id}/file`,
    isImage: a.mimeType.startsWith("image/"),
  };
}

export type AttachmentWithProject = AttachmentWithUploader;

export class AttachmentRepository {
  async create(input: {
    factoryId: string;
    taskId: string;
    projectId: string;
    actorUserId: string;
    filename: string;
    storedName: string;
    mimeType: string;
    sizeBytes: number;
    activityMessage: string;
  }) {
    return db.$transaction(async (tx) => {
      const txa = tx as unknown as TxWithAttachment;
      const row = await txa.taskAttachment.create({
        data: {
          factoryId: input.factoryId,
          taskId: input.taskId,
          filename: input.filename,
          storedName: input.storedName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          uploadedById: input.actorUserId,
        },
        include: { uploadedBy: true },
      });
      await tx.projectActivity.create({
        data: {
          factoryId: input.factoryId,
          projectId: input.projectId,
          taskId: input.taskId,
          actorUserId: input.actorUserId,
          type: "ATTACHMENT_ADDED" as never,
          message: input.activityMessage,
        },
      });
      return row;
    });
  }

  async findById(factoryId: string, attachmentId: string): Promise<AttachmentWithUploader | null> {
    const dbc = db as unknown as DbWithAttachment;
    return dbc.taskAttachment.findFirst({
      where: { id: attachmentId, factoryId },
      include: { uploadedBy: true },
    });
  }

  async listByTask(factoryId: string, taskId: string): Promise<AttachmentListItem[]> {
    const dbc = db as unknown as DbWithAttachment;
    const rows = await dbc.taskAttachment.findMany({
      where: { factoryId, taskId },
      include: { uploadedBy: true },
      orderBy: [{ createdAt: "asc" }],
    });
    return rows.map(mapAttachment);
  }

  async listByProject(
    factoryId: string,
    projectId: string,
  ): Promise<(AttachmentListItem & { taskTitle: string })[]> {
    const dbc = db as unknown as DbWithAttachment;
    const rows = await dbc.taskAttachment.findMany({
      where: { factoryId, task: { projectId } } as unknown as Record<string, unknown>,
      include: { uploadedBy: true, task: { select: { id: true, title: true } } } as unknown as {
        uploadedBy: true;
      },
      orderBy: [{ createdAt: "desc" }],
      take: 500,
    });
    return rows.map((r) => {
      const task = (r as unknown as { task?: { title?: string } }).task;
      return { ...mapAttachment(r), taskTitle: task?.title ?? "" };
    });
  }

  async deleteById(
    factoryId: string,
    actorUserId: string,
    attachmentId: string,
    activityMessage: string,
  ): Promise<{ id: string; storedName: string; taskId: string; projectId: string | null }> {
    return db.$transaction(async (tx) => {
      const txa = tx as unknown as TxWithAttachment;
      const row = await txa.taskAttachment.findFirst({
        where: { id: attachmentId, factoryId },
      });
      if (!row) {
        throw new Error("المرفق غير موجود.");
      }
      await txa.taskAttachment.delete({ where: { id: row.id } });

      const task = await tx.projectTask.findFirst({
        where: { id: row.taskId },
        select: { projectId: true },
      });

      if (task) {
        await tx.projectActivity.create({
          data: {
            factoryId,
            projectId: task.projectId,
            taskId: row.taskId,
            actorUserId,
            type: "ATTACHMENT_REMOVED" as never,
            message: activityMessage,
          },
        });
      }

      return {
        id: row.id,
        storedName: row.storedName,
        taskId: row.taskId,
        projectId: task?.projectId ?? null,
      };
    });
  }
}
