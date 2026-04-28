import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Files live OUTSIDE `public/` so Next doesn't serve them automatically.
 * They are streamed via an authenticated route handler.
 */
const PRIVATE_ROOT = path.resolve(process.cwd(), "private", "uploads");

function safeExt(filename: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  if (!m) return "";
  return "." + m[1].toLowerCase();
}

/** Reject anything that could escape the upload dir. */
export function validateFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) {
    throw new Error("اسم الملف مطلوب.");
  }
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("\0")) {
    throw new Error("اسم الملف يحتوي على أحرف غير مسموح بها.");
  }
  if (trimmed.length > 240) {
    throw new Error("اسم الملف طويل جداً.");
  }
  return trimmed;
}

export function buildStoredName(originalFilename: string): string {
  return `${randomUUID()}${safeExt(originalFilename)}`;
}

function targetDir(factoryId: string, taskId: string): string {
  // factoryId / taskId are CUIDs (alnum) — safe to use as dir names.
  if (!/^[A-Za-z0-9_-]+$/.test(factoryId) || !/^[A-Za-z0-9_-]+$/.test(taskId)) {
    throw new Error("معرف غير صالح.");
  }
  return path.join(PRIVATE_ROOT, factoryId, taskId);
}

export function buildStoragePath(factoryId: string, taskId: string, storedName: string): string {
  // storedName is server-generated UUID + ext; still validate.
  if (storedName.includes("..") || storedName.includes("/") || storedName.includes("\\")) {
    throw new Error("المسار غير صالح.");
  }
  return path.join(targetDir(factoryId, taskId), storedName);
}

export async function writeUploadedFile(
  factoryId: string,
  taskId: string,
  storedName: string,
  bytes: Buffer | Uint8Array,
): Promise<string> {
  const dir = targetDir(factoryId, taskId);
  await fs.mkdir(dir, { recursive: true });
  const full = buildStoragePath(factoryId, taskId, storedName);
  await fs.writeFile(full, bytes);
  return full;
}

export async function deleteStoredFile(
  factoryId: string,
  taskId: string,
  storedName: string,
): Promise<void> {
  const full = buildStoragePath(factoryId, taskId, storedName);
  await fs.unlink(full).catch(() => {
    // swallow — DB row removal is the source of truth
  });
}

export async function readStoredFile(
  factoryId: string,
  taskId: string,
  storedName: string,
): Promise<Buffer> {
  const full = buildStoragePath(factoryId, taskId, storedName);
  return fs.readFile(full);
}
