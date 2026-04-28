import { describe, expect, it } from "vitest";

import { parseMentionTokens } from "./comment.schemas";

describe("parseMentionTokens()", () => {
  it("returns empty array for empty input", () => {
    expect(parseMentionTokens("")).toEqual([]);
  });

  it("returns empty array when there is no @ at all", () => {
    expect(parseMentionTokens("hello world")).toEqual([]);
  });

  it("ignores a lone @ with nothing after it", () => {
    expect(parseMentionTokens("ping @")).toEqual([]);
  });

  it("ignores @@ (no name token)", () => {
    expect(parseMentionTokens("ping @@")).toEqual([]);
  });

  it("extracts a single English first name and lowercases it", () => {
    expect(parseMentionTokens("hi @Ahmed how are you")).toEqual(["ahmed"]);
  });

  it("extracts an Arabic first name", () => {
    expect(parseMentionTokens("مرحبا @محمد كيف الحال")).toEqual(["محمد"]);
  });

  it("extracts mixed Arabic and English mentions", () => {
    const tokens = parseMentionTokens("ping @Sara و @خالد للمراجعة");
    expect(tokens.sort()).toEqual(["sara", "خالد"].sort());
  });

  it("dedupes repeated mentions", () => {
    expect(parseMentionTokens("@ali @ali @Ali")).toEqual(["ali"]);
  });

  it("recognises a mention at the very start of the body", () => {
    expect(parseMentionTokens("@noor please review")).toEqual(["noor"]);
  });

  it("recognises a mention at the very end of the body", () => {
    expect(parseMentionTokens("please review @noor")).toEqual(["noor"]);
  });

  it("does NOT extract emails (no preceding whitespace before the @)", () => {
    expect(parseMentionTokens("ping me at user@example.com")).toEqual([]);
  });

  it("supports underscores, hyphens, dots and digits in tokens", () => {
    const tokens = parseMentionTokens("@a.b @c-d @e_f @user42");
    expect(new Set(tokens)).toEqual(new Set(["a.b", "c-d", "e_f", "user42"]));
  });

  it("stops at punctuation boundaries", () => {
    expect(parseMentionTokens("hi @sara, are you here?")).toEqual(["sara"]);
    expect(parseMentionTokens("ping @sara!")).toEqual(["sara"]);
  });

  it("supports newlines between mentions", () => {
    expect(parseMentionTokens("@one\n@two")).toEqual(["one", "two"]);
  });

  it("handles unicode latin letters with diacritics", () => {
    expect(parseMentionTokens("hello @Renée please")).toEqual(["renée"]);
  });
});
