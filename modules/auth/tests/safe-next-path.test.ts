import { toSafeNextPath } from "@softure-ai/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("toSafeNextPath", () => {
  it.each(["/", "/account", "/account/password?tab=1#top", "/search?q=a%2Fb"])("keeps the same-origin path %j", (path) => {
    expect(toSafeNextPath(path, "/home")).toBe(path);
  });

  it.each([
    ["another origin", "https://evil.example/account"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a backslash later on", "/a\\b"],
    ["a relative path", "account"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a tab inside", "/\t/evil.example"],
    ["a newline", "/account\nSet-Cookie: x"],
    ["an empty string", ""],
    ["not a string", 42],
    ["nothing", undefined],
  ])("falls back on %s", (_case, candidate) => {
    expect(toSafeNextPath(candidate, "/home")).toBe("/home");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(toSafeNextPath("/a/../../b", "/home")).toBe("/b");
  });

  describe("length", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("keeps an OAuth authorize path of several thousand characters", () => {
      const path = `/oauth/authorize?response_type=code&state=${"s".repeat(3000)}&code_challenge=${"c".repeat(1000)}`;
      expect(toSafeNextPath(path, "/home")).toBe(path);
    });

    it("falls back over 8192 characters and logs the length, never the path", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(toSafeNextPath(`/${"a".repeat(8192)}`, "/home")).toBe("/home");
      expect(warn).toHaveBeenCalledWith("@softure-ai/auth: a next path of 8193 characters is over the 8192 limit; using the fallback");
      expect(toSafeNextPath(`/${"a".repeat(8191)}`, "/home")).toBe(`/${"a".repeat(8191)}`);
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});
