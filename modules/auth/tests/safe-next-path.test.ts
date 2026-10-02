import { toSafeNextPath } from "@softure-ai/auth";
import { describe, expect, it } from "vitest";

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
    ["something over 2048 characters", `/${"a".repeat(2048)}`],
    ["not a string", 42],
    ["nothing", undefined],
  ])("falls back on %s", (_case, candidate) => {
    expect(toSafeNextPath(candidate, "/home")).toBe("/home");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(toSafeNextPath("/a/../../b", "/home")).toBe("/b");
  });
});
