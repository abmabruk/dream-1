import "server-only";

import { HttpError } from "@/lib/http/http-error";
import { db } from "@/lib/db";
import { hasPermission, type UserRole } from "@/modules/auth/roles";

import {
  CommentInput,
  parseMentionTokens,
  type CommentListItem,
} from "./comment.schemas";
import { CommentRepository, mapComment } from "./comment.repository";

export class CommentService {
  constructor(private readonly repository = new CommentRepository()) {}

  private assertView(role: UserRole) {
    if (!hasPermission(role, "projects:view")) {
      throw new HttpError(403, "ليس لديك صلاحية عرض المشاريع.");
    }
  }

  /** Resolve `@firstname` tokens to userIds, scoped to the same factory. */
  private async resolveMentions(
    factoryId: string,
    body: string,
  ): Promise<string[]> {
    const tokens = parseMentionTokens(body);
    if (tokens.length === 0) return [];
    const users = await db.user.findMany({
      where: {
        factoryId,
        status: { in: ["ACTIVE", "INVITED"] },
      },
      select: { id: true, firstName: true },
    });
    const ids = new Set<string>();
    for (const u of users) {
      if (tokens.includes(u.firstName.toLowerCase())) {
        ids.add(u.id);
      }
    }
    return Array.from(ids);
  }

  async create(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    projectId: string,
    taskId: string,
    input: unknown,
  ): Promise<CommentListItem> {
    this.assertView(actor.role);
    const parsed = CommentInput.parse(input);

    const task = await db.projectTask.findFirst({
      where: { id: taskId, factoryId, projectId },
      select: { id: true, projectId: true, title: true },
    });
    if (!task) {
      throw new HttpError(404, "المهمة غير موجودة.");
    }

    const mentionedUserIds = await this.resolveMentions(factoryId, parsed.body);

    const preview =
      parsed.body.length > 100 ? `${parsed.body.slice(0, 100)}…` : parsed.body;
    const href = `/app/projects/${projectId}?tab=tasks#task-${taskId}`;

    const created = await this.repository.createWithMentions({
      factoryId,
      taskId,
      projectId,
      actorUserId: actor.userId,
      body: parsed.body,
      mentionedUserIds,
      notificationTitle: "تم ذكرك في تعليق",
      notificationMessage: preview,
      notificationHref: href,
    });

    return mapComment(created, mentionedUserIds);
  }

  async listByTask(
    factoryId: string,
    role: UserRole,
    taskId: string,
  ): Promise<CommentListItem[]> {
    this.assertView(role);
    return this.repository.listByTask(factoryId, taskId);
  }

  async deleteById(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    commentId: string,
  ): Promise<{ id: string }> {
    this.assertView(actor.role);
    const row = await this.repository.findById(factoryId, commentId);
    if (!row) {
      throw new HttpError(404, "التعليق غير موجود.");
    }
    const isManager = hasPermission(actor.role, "projects:manage");
    const isAuthor = row.authorId === actor.userId;
    if (!isManager && !isAuthor) {
      throw new HttpError(403, "لا يمكنك حذف هذا التعليق.");
    }
    return this.repository.deleteById(factoryId, commentId);
  }
}
