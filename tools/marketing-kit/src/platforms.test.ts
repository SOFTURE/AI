import { describe, expect, it } from "vitest";

import { channelLink, isChannelCode } from "./platforms.js";

describe("isChannelCode", () => {
  it.each([["tiktok-01"], ["fb_group"], ["a".repeat(32)]])("accepts %s, as the analytics reader does", (code) => {
    expect(isChannelCode(code)).toBe(true);
  });

  it.each([
    ["an empty code", ""],
    ["uppercase", "IG-01"],
    ["a space", "ig 01"],
    ["a slash from a pasted URL", "ig/01"],
    ["a doubled dash", "ig--01"],
    ["a leading dash", "-ig"],
    ["33 characters", "a".repeat(33)],
  ])("refuses %s, which the analytics reader would ignore", (_case, code) => {
    expect(isChannelCode(code)).toBe(false);
  });
});

describe("channelLink", () => {
  it("replaces every {code} in the template", () => {
    expect(channelLink("https://example.com/{code}?z={code}", "ig-01")).toBe("https://example.com/ig-01?z=ig-01");
  });
});
