import { describe, expect, it } from "bun:test";
import { containsPattern } from "../src/modules/interaction/shared";

describe("containsPattern", () => {
  it("wraps the text for a substring match", () => {
    expect(containsPattern("vector")).toBe("%vector%");
  });

  it("escapes LIKE wildcards and the escape character itself", () => {
    expect(containsPattern(String.raw`50%_a\b`)).toBe(String.raw`%50\%\_a\\b%`);
  });
});
