import "server-only";

import { authenticator } from "otplib";
import QRCode from "qrcode";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Allow ±1 step (30s window each side) to absorb clock skew.
authenticator.options = { window: 1, step: 30 };

export const ISSUER = "Dream 1";

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20);
}

export function buildOtpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function buildQrDataUrl(otpauth: string): Promise<string> {
  return QRCode.toDataURL(otpauth, { errorCorrectionLevel: "M", margin: 1 });
}

export function verifyTotp(token: string, secret: string): boolean {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.verify({ token: cleaned, secret });
  } catch {
    return false;
  }
}

// ─── Recovery codes ──────────────────────────────────────────
// 10 codes, 10 chars each (uppercased base32-style), formatted "XXXXX-XXXXX".

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1/I/O
const RECOVERY_COUNT = 10;
const RECOVERY_LEN = 10;

function randomCode(): string {
  const bytes = randomBytes(RECOVERY_LEN);
  let out = "";
  for (let i = 0; i < RECOVERY_LEN; i++) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_COUNT }, () => randomCode());
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]+/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(normalized, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyRecoveryCode(code: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const normalized = normalizeRecoveryCode(code);
  const derived = scryptSync(normalized, salt, 32);
  const storedBuf = Buffer.from(key, "hex");
  if (storedBuf.length !== derived.length) return false;
  return timingSafeEqual(storedBuf, derived);
}
