import "server-only";

import type { UserRole } from "@/modules/auth/roles";

import { HttpError } from "@/lib/http/http-error";
import { hasPermission } from "@/modules/auth/roles";
import { db } from "@/lib/db";

import {
  ATTACHMENT_MAX_BYTES,
  isAllowedMime,
  type AttachmentListItem,
} from "./attachment.schemas";
import {
  AttachmentRepository,
  mapAttachment,
} from "./attachment.repository";
import {
  buildStoredName,
  deleteStoredFile,
  validateFilename,
  writeUploadedFile,
} from "./storage";

export class AttachmentService {
  constructor(private readonly repository = new AttachmentRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "projects:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض المشاريع.");
    }
  }

  /** Write requires `projects:manage` OR being the task assignee. */
  private async assertWrite(
    role: UserRole,
    actorUserId: string,
    factoryId: string,
    taskId: string,
  ) {
    if (hasPermission(role, "projects:manage")) {
      return;
    }
    if (!hasPermission(role, "projects:view")) {
      throw new HttpError(403, "ليس لديك صلاحية الوصول.");
    }
    const task = await db.projectTask.findFirst({
      where: { id: taskId, factoryId },
      select: { assignedToUserId: true, projectId: true },
    });
    if (!task) {
      throw new HttpError(404, "المهمة غير موجودة.");
    }
    if (task.assignedToUserId !== actorUserId) {
      throw new HttpError(403, "هذه المهمة ليست مسندة إليك.");
    }
  }

  async upload(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    taskId: string,
    file: File,
  ): Promise<AttachmentListItem> {
    await this.assertWrite(actor.role, actor.userId, factoryId, taskId);

    const sizeBytes = file.size;
    if (sizeBytes <= 0) {
      throw new HttpError(400, "الملف فارغ.");
    }
    if (sizeBytes > ATTACHMENT_MAX_BYTES) {
      throw new HttpError(413, "حجم الملف يتجاوز ١٠ ميجابايت.");
    }
    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMime(mimeType)) {
      throw new HttpError(415, "نوع الملف غير مدعوم. الصور وملفات PDF فقط.");
    }
    const filename = validateFilename(file.name || "file");

    const task = await db.projectTask.findFirst({
      where: { id: taskId, factoryId },
      select: { projectId: true, title: true },
    });
    if (!task) {
      throw new HttpError(404, "المهمة غير موجودة.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedName = buildStoredName(filename);
    await writeUploadedFile(factoryId, taskId, storedName, buffer);

    try {
      const created = await this.repository.create({
        factoryId,
        taskId,
        projectId: task.projectId,
        actorUserId: actor.userId,
        filename,
        storedName,
        mimeType,
        sizeBytes,
        activityMessage: `أُضيف مرفق: ${filename}`,
      });
      return mapAttachment(created);
    } catch (err) {
      // best-effort cleanup if DB insert fails
      await deleteStoredFile(factoryId, taskId, storedName);
      throw err;
    }
  }

  async listByTask(
    factoryId: string,
    role: UserRole,
    taskId: string,
  ): Promise<AttachmentListItem[]> {
    this.assertView(role);
    return this.repository.listByTask(factoryId, taskId);
  }

  async listByProject(
    factoryId: string,
    role: UserRole,
    projectId: string,
  ) {
    this.assertView(role);
    return this.repository.listByProject(factoryId, projectId);
  }

  async findForDownload(factoryId: string, role: UserRole, attachmentId: string) {
    this.assertView(role);
    const row = await this.repository.findById(factoryId, attachmentId);
    if (!row) {
      throw new HttpError(404, "المرفق غير موجود.");
    }
    return row;
  }

  async deleteById(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    attachmentId: string,
  ): Promise<{ id: string }> {
    const row = await this.repository.findById(factoryId, attachmentId);
    if (!row) {
      throw new HttpError(404, "المرفق غير موجود.");
    }
    const isManager = hasPermission(actor.role, "projects:manage");
    const isOwner = row.uploadedById === actor.userId;
    if (!isManager && !isOwner) {
      throw new HttpError(403, "لا يمكنك حذف هذا المرفق.");
    }
    const result = await this.repository.deleteById(
      factoryId,
      actor.userId,
      attachmentId,
      `حُذف مرفق: ${row.filename}`,
    );
    await deleteStoredFile(factoryId, result.taskId, result.storedName);
    return { id: result.id };
  }
}
