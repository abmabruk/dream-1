import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

describe("encryptSecret / decryptSecret", () => {
  it("roundtrips back to the original plaintext", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const ct = encryptSecret(plaintext);
    expect(decryptSecret(ct)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-input";
    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);
    expect(a).not.toBe(b);
    // Both must still decrypt to the same value.
    expect(decryptSecret(a)).toBe(plaintext);
    expect(decryptSecret(b)).toBe(plaintext);
  });

  it("ciphertext format is iv:tag:ct with correct hex lengths", () => {
    const ct = encryptSecret("hello");
    const parts = ct.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars; tag = 16 bytes = 32 hex chars.
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
    expect(parts[2].length).toBeGreaterThan(0);
    // All segments must be valid hex.
    for (const p of parts) {
      expect(/^[0-9a-f]+$/.test(p)).toBe(true);
    }
  });

  it("decrypt with tampered tag throws", () => {
    const ct = encryptSecret("hello");
    const [iv, tag, body] = ct.split(":");
    // Flip the first hex nibble of the tag to produce an invalid auth tag.
    const flipped = (tag[0] === "0" ? "1" : "0") + tag.slice(1);
    const tampered = `${iv}:${flipped}:${body}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("decrypt rejects malformed payloads", () => {
    expect(() => decryptSecret("not-a-payload")).toThrow(
      /Invalid encrypted payload/,
    );
    expect(() => decryptSecret("aa:bb")).toThrow(/Invalid encrypted payload/);
  });

  it("handles empty string", () => {
    const ct = encryptSecret("");
    expect(decryptSecret(ct)).toBe("");
  });

  it("handles non-ASCII (Arabic) input", () => {
    const plaintext = "السلام عليكم";
    const ct = encryptSecret(plaintext);
    expect(decryptSecret(ct)).toBe(plaintext);
  });
});
