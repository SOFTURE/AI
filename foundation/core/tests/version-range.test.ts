import { describe, expect, it } from "vitest";
import { isVersion, parseVersionRange, satisfiesRange } from "@softure-ai/core";

function satisfies(version: string, rangeText: string): boolean {
  const range = parseVersionRange(rangeText);
  if (!range.ok) throw new Error(`test setup: invalid range ${rangeText}`);
  return satisfiesRange(version, range.value);
}

describe("isVersion", () => {
  it.each(["0.0.0", "0.1.0", "12.34.56"])("accepts %s", (text) => {
    expect(isVersion(text)).toBe(true);
  });

  it.each(["", "1.2", "1.2.3.4", "01.2.3", "1.2.3-beta.1", "v1.2.3", "^1.2.3"])("rejects %j", (text) => {
    expect(isVersion(text)).toBe(false);
  });
});

describe("parseVersionRange", () => {
  it("marks a range ending in ? as optional", () => {
    const range = parseVersionRange("^0.1.0?");
    expect(range.ok && range.value.optional).toBe(true);
    const required = parseVersionRange("^0.1.0");
    expect(required.ok && required.value.optional).toBe(false);
  });

  it.each(["", "?", ">=1.0.0", "^1.2", "1.x", "^^1.2.3", "~", "latest", "1.2.3 || 2.0.0"])("rejects %j", (text) => {
    expect(parseVersionRange(text)).toEqual({ ok: false, error: "core.invalid_version_range" });
  });
});

describe("satisfiesRange", () => {
  it.each([
    ["0.1.0", "^0.1.0", true],
    ["0.1.9", "^0.1.0", true],
    ["0.2.0", "^0.1.0", false],
    ["0.0.9", "^0.1.0", false],
    ["0.0.3", "^0.0.3", true],
    ["0.0.4", "^0.0.3", false],
    ["1.9.0", "^1.2.3", true],
    ["1.2.2", "^1.2.3", false],
    ["2.0.0", "^1.2.3", false],
    ["1.2.9", "~1.2.3", true],
    ["1.3.0", "~1.2.3", false],
    ["1.2.3", "1.2.3", true],
    ["1.2.4", "1.2.3", false],
    ["7.0.1", "*", true],
    ["0.1.5", "^0.1.0?", true],
  ])("%s in %s is %s", (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it("never matches a version it cannot parse", () => {
    expect(satisfies("1.2", "*")).toBe(false);
  });
});
