import { describe, expect, it } from "vitest";

import {
  buildStoragePath,
  buildStoredName,
  validateFilename,
} from "./storage";

describe("validateFilename()", () => {
  it("accepts a normal filename", () => {
    expect(validateFilename("photo.jpg")).toBe("photo.jpg");
  });

  it("trims surrounding whitespace", () => {
    expect(validateFilename("   image.png   ")).toBe("image.png");
  });

  it("accepts Arabic filenames", () => {
    expect(validateFilename("صورة.jpg")).toBe("صورة.jpg");
  });

  it("rejects empty / whitespace-only filenames", () => {
    expect(() => validateFilename("")).toThrow();
    expect(() => validateFilename("    ")).toThrow();
  });

  it("rejects path traversal with ..", () => {
    expect(() => validateFilename("../etc/passwd")).toThrow();
    expect(() => validateFilename("foo..bar.png")).toThrow();
  });

  it("rejects forward slashes", () => {
    expect(() => validateFilename("a/b.jpg")).toThrow();
    expect(() => validateFilename("/abs.jpg")).toThrow();
  });

  it("rejects backslashes", () => {
    expect(() => validateFilename("a\\b.jpg")).toThrow();
  });

  it("rejects null bytes", () => {
    expect(() => validateFilename("foo\0.jpg")).toThrow();
  });

  it("rejects names longer than 240 chars", () => {
    const long = `${"a".repeat(241)}.jpg`;
    expect(() => validateFilename(long)).toThrow();
  });

  it("accepts filenames at exactly the 240 char boundary", () => {
    const ok = "a".repeat(240);
    expect(validateFilename(ok)).toBe(ok);
  });
});

describe("buildStoredName()", () => {
  it("generates a UUID-shaped name and preserves the lowercased extension", () => {
    const stored = buildStoredName("Photo.JPG");
    // 36-char UUID + ".jpg"
    expect(stored).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
    );
  });

  it("works without an extension", () => {
    const stored = buildStoredName("README");
    expect(stored).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("limits the extension to a sane length", () => {
    // .verylongextension > 8 chars → ext is dropped
    const stored = buildStoredName("file.verylongextension");
    expect(stored).not.toContain(".verylongextension");
  });

  it("never collides across calls", () => {
    const a = buildStoredName("a.png");
    const b = buildStoredName("a.png");
    expect(a).not.toBe(b);
  });
});

describe("buildStoragePath()", () => {
  it("includes factoryId, taskId and stored name in the path", () => {
    const p = buildStoragePath("factory_abc", "task_xyz", "uuid.png");
    expect(p).toContain("factory_abc");
    expect(p).toContain("task_xyz");
    expect(p).toContain("uuid.png");
  });

  it("rejects factory IDs with path-traversal characters", () => {
    expect(() => buildStoragePath("../bad", "task", "uuid.png")).toThrow();
    expect(() => buildStoragePath("a/b", "task", "uuid.png")).toThrow();
  });

  it("rejects task IDs with path-traversal characters", () => {
    expect(() => buildStoragePath("factory", "../bad", "uuid.png")).toThrow();
  });

  it("rejects stored names that contain path separators", () => {
    expect(() => buildStoragePath("factory", "task", "../uuid.png")).toThrow();
    expect(() => buildStoragePath("factory", "task", "a/b.png")).toThrow();
    expect(() => buildStoragePath("factory", "task", "a\\b.png")).toThrow();
  });
});
