import { describe, expect, it } from "vitest";

import { readOptions } from "../src/cli/options.js";

describe("readOptions", () => {
  it("reads a command, a film and the defaults", () => {
    expect(readOptions(["render", "anna-calculator"])).toEqual({
      ok: true,
      options: {
        command: "render",
        filmId: "anna-calculator",
        isCommit: false,
        today: undefined,
        url: undefined,
        quality: undefined,
        configPath: "marketing.json",
      },
    });
  });

  it("reads every flag", () => {
    const result = readOptions(["record", "a", "--today=2026-09-29", "--url=http://localhost:4000/x", "--config=video/marketing.json"]);
    expect(result.ok && result.options).toMatchObject({ today: "2026-09-29", url: "http://localhost:4000/x", configPath: "video/marketing.json" });
  });

  it("accepts the posts command", () => {
    expect(readOptions(["posts", "a"]).ok).toBe(true);
  });

  it("reads og without an image as every image", () => {
    expect(readOptions(["og"])).toEqual({ ok: true, options: { command: "og", imageId: null, configPath: "marketing.json" } });
  });

  it("reads og with one image and a config", () => {
    expect(readOptions(["og", "calculator", "--config=site/marketing.json"])).toEqual({
      ok: true,
      options: { command: "og", imageId: "calculator", configPath: "site/marketing.json" },
    });
  });

  it("accepts --commit on voice", () => {
    expect(readOptions(["voice", "a", "--commit"])).toMatchObject({ ok: true, options: { isCommit: true } });
  });

  it.each([
    ["an unknown command", ["film", "a"], /unknown command "film"/],
    ["no command", [], /unknown command ""/],
    ["an unknown flag (a typo must not pass silently)", ["record", "a", "--todya=2026-09-29"], /unknown flag --todya/],
    ["no film", ["render"], /name the film/],
    ["two films", ["render", "a", "b"], /one film at a time/],
    ["a film id with uppercase", ["render", "Anna"], /lowercase letters, digits and hyphens/],
    ["a malformed --today", ["record", "a", "--today=29.09.2026"], /expected YYYY-MM-DD/],
    ["an unknown quality", ["render", "a", "--quality=ultra"], /expected draft \| standard \| high/],
    ["--commit with a value", ["voice", "a", "--commit=yes"], /takes no value/],
    ["--commit on all, which never pays", ["all", "a", "--commit"], /from the cache only/],
    ["--config without a path", ["render", "a", "--config"], /--config needs a path/],
    ["--url without an address", ["record", "a", "--url"], /--url needs an address/],
    ["two OG images", ["og", "a", "b"], /one OG image at a time/],
    ["an OG image id with uppercase", ["og", "Calculator"], /lowercase letters, digits and hyphens/],
    ["a film flag on og", ["og", "--quality=draft"], /og takes only --config, got --quality/],
    ["--config without a path on og", ["og", "--config"], /--config needs a path/],
  ])("refuses %s", (_case, argv, message) => {
    const result = readOptions(argv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });
});
