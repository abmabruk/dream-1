import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce recommended for GCM
const TAG_LEN = 16;

function getKey(): Buffer {
  // Derive a stable 32-byte key from AUTH_SECRET. AUTH_SECRET is required
  // (>= 32 chars per env schema) — if it ever rotates, encrypted secrets
  // become unreadable, which is the desired behavior (re-enroll).
  const secret = env.AUTH_SECRET || "dev-fallback-secret-not-for-production";
  return createHash("sha256").update(`dream1:totp:${secret}`).digest();
}

/** Encrypt plaintext → "iv:tag:ciphertext" hex format. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const key = getKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/** Decrypt "iv:tag:ciphertext" → plaintext. Throws on tampering. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("Invalid encrypted payload sizes");
  }
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
