import { z } from "zod";

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const ATTACHMENT_ALLOWED_MIME_PREFIXES = ["image/"] as const;
export const ATTACHMENT_ALLOWED_EXACT_MIME = ["application/pdf"] as const;

export function isAllowedMime(mime: string): boolean {
  if (ATTACHMENT_ALLOWED_EXACT_MIME.includes(mime as typeof ATTACHMENT_ALLOWED_EXACT_MIME[number])) {
    return true;
  }
  return ATTACHMENT_ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

export const attachmentListItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedById: z.string().nullable(),
  uploadedByName: z.string().nullable(),
  createdAt: z.string(),
  url: z.string(),
  isImage: z.boolean(),
});

export type AttachmentListItem = z.infer<typeof attachmentListItemSchema>;
