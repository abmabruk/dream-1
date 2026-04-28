import "server-only";

import { db, type PrismaTransaction } from "@/lib/db";
import type { CommentListItem } from "./comment.schemas";

type CommentRow = {
  id: string;
  factoryId: string;
  taskId: string;
  authorId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

type CommentWithAuthor = CommentRow & {
  author: { firstName: string; lastName: string } | null;
};

interface CommentDelegate {
  create(args: {
    data: Omit<CommentRow, "id" | "createdAt" | "updatedAt">;
    include?: { author?: boolean };
  }): Promise<CommentWithAuthor>;
  findFirst(args: {
    where: { id?: string; factoryId?: string; taskId?: string };
    include?: { author?: boolean };
  }): Promise<CommentWithAuthor | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: { author?: boolean };
    orderBy?: Record<string, "asc" | "desc"> | { createdAt?: "asc" | "desc" }[];
    take?: number;
  }): Promise<CommentWithAuthor[]>;
  delete(args: { where: { id: string } }): Promise<CommentRow>;
}

interface DbWithComment {
  taskComment: CommentDelegate;
}

interface TxWithComment {
  taskComment: CommentDelegate;
  projectTask: PrismaTransaction["projectTask"];
  projectActivity: PrismaTransaction["projectActivity"];
  notification: PrismaTransaction["notification"];
  user: PrismaTransaction["user"];
}

function displayName(user: { firstName: string; lastName: string } | null | undefined) {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim();
}

export function mapComment(c: CommentWithAuthor, mentionedUserIds: string[] = []): CommentListItem {
  return {
    id: c.id,
    taskId: c.taskId,
    authorId: c.authorId,
    authorName: displayName(c.author),
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    mentionedUserIds,
  };
}

export class CommentRepository {
  /** Single transaction: create comment + activity rows + notifications. */
  async createWithMentions(input: {
    factoryId: string;
    taskId: string;
    projectId: string;
    actorUserId: string;
    body: string;
    mentionedUserIds: string[];
    notificationTitle: string;
    notificationMessage: string;
    notificationHref: string;
  }) {
    return db.$transaction(async (tx) => {
      const txc = tx as unknown as TxWithComment;
      const row = await txc.taskComment.create({
        data: {
          factoryId: input.factoryId,
          taskId: input.taskId,
          authorId: input.actorUserId,
          body: input.body,
        },
        include: { author: true },
      });

      // Activity: COMMENT_ADDED (always) + TASK_MENTION (if any mentions)
      const previewBody =
        input.body.length > 120 ? `${input.body.slice(0, 120)}…` : input.body;
      await tx.projectActivity.create({
        data: {
          factoryId: input.factoryId,
          projectId: input.projectId,
          taskId: input.taskId,
          actorUserId: input.actorUserId,
          type: "COMMENT_ADDED" as never,
          message: `علّق: ${previewBody}`,
        },
      });

      if (input.mentionedUserIds.length > 0) {
        await tx.projectActivity.create({
          data: {
            factoryId: input.factoryId,
            projectId: input.projectId,
            taskId: input.taskId,
            actorUserId: input.actorUserId,
            type: "TASK_MENTION" as never,
            message: `أشار إلى ${input.mentionedUserIds.length} عضو في تعليق.`,
          },
        });

        // Create one Notification per mentioned user, deduped per comment.
        for (const userId of input.mentionedUserIds) {
          if (userId === input.actorUserId) continue; // don't notify self
          await tx.notification.upsert({
            where: {
              userId_dedupeKey: {
                userId,
                dedupeKey: `TASK_MENTIONED:${input.taskId}:${row.id}:${userId}`,
              },
            },
            create: {
              factoryId: input.factoryId,
              userId,
              type: "TASK_MENTIONED" as never,
              dedupeKey: `TASK_MENTIONED:${input.taskId}:${row.id}:${userId}`,
              title: input.notificationTitle,
              message: input.notificationMessage,
              href: input.notificationHref,
              entityType: "TASK_COMMENT",
              entityId: row.id,
            },
            update: {},
          });
        }
      }

      return row;
    });
  }

  async findById(factoryId: string, commentId: string): Promise<CommentWithAuthor | null> {
    const dbc = db as unknown as DbWithComment;
    return dbc.taskComment.findFirst({
      where: { id: commentId, factoryId },
      include: { author: true },
    });
  }

  async listByTask(factoryId: string, taskId: string): Promise<CommentListItem[]> {
    const dbc = db as unknown as DbWithComment;
    const rows = await dbc.taskComment.findMany({
      where: { factoryId, taskId },
      include: { author: true },
      orderBy: [{ createdAt: "asc" }],
      take: 500,
    });
    return rows.map((r) => mapComment(r));
  }

  async deleteById(factoryId: string, commentId: string): Promise<{ id: string }> {
    const dbc = db as unknown as DbWithComment;
    const row = await dbc.taskComment.findFirst({
      where: { id: commentId, factoryId },
    });
    if (!row) {
      throw new Error("التعليق غير موجود.");
    }
    await dbc.taskComment.delete({ where: { id: row.id } });
    return { id: row.id };
  }
}
