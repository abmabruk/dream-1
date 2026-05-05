import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FLAG_NAMES, getFlags, isEnabled, requireFlag } from "./flags";

const FLAG_ENV_KEYS = FLAG_NAMES.map((f) => `FLAGS_${f.toUpperCase()}`);

describe("flags", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of FLAG_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of FLAG_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("is off by default", () => {
    expect(isEnabled("quotes")).toBe(false);
  });

  it("is on when env=true", () => {
    process.env.FLAGS_QUOTES = "true";
    expect(isEnabled("quotes")).toBe(true);
  });

  it("is off for any value other than the literal string 'true'", () => {
    for (const value of ["TRUE", "1", "yes", "on", "True", " true ", ""]) {
      process.env.FLAGS_QUOTES = value;
      expect(isEnabled("quotes")).toBe(false);
    }
  });

  it("getFlags returns a full record covering every known flag", () => {
    const flags = getFlags();
    for (const name of FLAG_NAMES) {
      expect(flags).toHaveProperty(name);
      expect(typeof flags[name]).toBe("boolean");
      expect(flags[name]).toBe(false);
    }
  });

  it("getFlags reflects enabled flags", () => {
    process.env.FLAGS_INVOICES = "true";
    const flags = getFlags();
    expect(flags.invoices).toBe(true);
    expect(flags.quotes).toBe(false);
  });

  it("requireFlag throws when flag is off", () => {
    expect(() => requireFlag("payments")).toThrow(/payments/);
    expect(() => requireFlag("payments")).toThrow(/FLAGS_PAYMENTS/);
  });

  it("requireFlag does not throw when flag is on", () => {
    process.env.FLAGS_PAYMENTS = "true";
    expect(() => requireFlag("payments")).not.toThrow();
  });
});
