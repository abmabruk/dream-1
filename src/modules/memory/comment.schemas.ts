import { z } from "zod";

export const CommentInput = z.object({
  body: z.string().trim().min(1, "التعليق فارغ.").max(4000),
});
export type CommentInputType = z.infer<typeof CommentInput>;

export const commentListItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  mentionedUserIds: z.array(z.string()),
});

export type CommentListItem = z.infer<typeof commentListItemSchema>;

/**
 * Parse `@firstname` mentions out of a comment body.
 * Names are letters (Arabic + Latin), digits, underscore, hyphen, dot.
 * Stops at whitespace or punctuation. Returns lowercased trimmed names.
 */
export function parseMentionTokens(body: string): string[] {
  if (!body) return [];
  const re = /(^|\s)@([\p{L}\p{N}_.-]+)/gu;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const tok = m[2].trim();
    if (tok) out.add(tok.toLowerCase());
  }
  return Array.from(out);
}
