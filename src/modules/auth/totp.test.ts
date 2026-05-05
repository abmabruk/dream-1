import { describe, expect, it } from "vitest";
import { authenticator } from "otplib";

import {
  ISSUER,
  buildOtpauthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyRecoveryCode,
  verifyTotp,
} from "./totp";

describe("generateTotpSecret", () => {
  it("returns a non-empty base32 string", () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThanOrEqual(16);
    // base32 alphabet (otplib uses RFC 4648 base32, uppercased)
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it("returns different secrets on each call", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("buildOtpauthUrl", () => {
  it("includes account name and issuer", () => {
    const url = buildOtpauthUrl("user@example.com", "JBSWY3DPEHPK3PXP");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain(encodeURIComponent(ISSUER));
    expect(url).toContain(encodeURIComponent("user@example.com"));
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});

describe("verifyTotp", () => {
  it("accepts a freshly generated valid code", () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotp(token, secret)).toBe(true);
  });

  it("strips whitespace before validating", () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    const spaced = `${token.slice(0, 3)} ${token.slice(3)}`;
    expect(verifyTotp(spaced, secret)).toBe(true);
  });

  it("rejects an obviously invalid code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("000000", secret)).toBe(false);
  });

  it("rejects non-6-digit input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("abcdef", secret)).toBe(false);
    expect(verifyTotp("12345", secret)).toBe(false);
    expect(verifyTotp("1234567", secret)).toBe(false);
    expect(verifyTotp("", secret)).toBe(false);
  });
});

describe("generateRecoveryCodes", () => {
  it("returns 10 codes formatted XXXXX-XXXXX", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(code)).toBe(true);
    }
  });

  it("does not include ambiguous chars 0/1/I/O", () => {
    const codes = generateRecoveryCodes().join("");
    expect(/[01IO]/.test(codes)).toBe(false);
  });

  it("returns unique codes (overwhelmingly likely)", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("normalizeRecoveryCode", () => {
  it("strips dashes/whitespace and uppercases", () => {
    expect(normalizeRecoveryCode("ab cd e-fg hij")).toBe("ABCDEFGHIJ");
  });
});

describe("hashRecoveryCode / verifyRecoveryCode", () => {
  it("roundtrips: hashed code verifies against the original", () => {
    const code = "ABCDE-FGHJK";
    const stored = hashRecoveryCode(code);
    expect(verifyRecoveryCode(code, stored)).toBe(true);
  });

  it("verifies regardless of case/dashes (normalization)", () => {
    const code = "ABCDE-FGHJK";
    const stored = hashRecoveryCode(code);
    expect(verifyRecoveryCode("abcdefghjk", stored)).toBe(true);
    expect(verifyRecoveryCode("abcde-fghjk", stored)).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const stored = hashRecoveryCode("ABCDE-FGHJK");
    expect(verifyRecoveryCode("ZZZZZ-ZZZZZ", stored)).toBe(false);
  });

  it("hashed string never equals the plaintext", () => {
    const code = "ABCDE-FGHJK";
    const stored = hashRecoveryCode(code);
    expect(stored).not.toBe(code);
    expect(stored).not.toContain(code);
    expect(stored).not.toContain(normalizeRecoveryCode(code));
  });

  it("two hashes of the same code differ (random salt) but both verify", () => {
    const code = "ABCDE-FGHJK";
    const a = hashRecoveryCode(code);
    const b = hashRecoveryCode(code);
    expect(a).not.toBe(b);
    expect(verifyRecoveryCode(code, a)).toBe(true);
    expect(verifyRecoveryCode(code, b)).toBe(true);
  });

  it("returns false for a malformed stored value", () => {
    expect(verifyRecoveryCode("ABCDE-FGHJK", "no-colon-here")).toBe(false);
    expect(verifyRecoveryCode("ABCDE-FGHJK", "")).toBe(false);
  });
});
