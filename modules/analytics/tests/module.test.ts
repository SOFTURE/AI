// The module definition: its manifest, its options and their defaults.
import { readFileSync } from "node:fs";
import { analytics, DEFAULT_CHANNEL_PATTERN } from "@softure-ai/analytics";
import { toModuleJson } from "@softure-ai/core";
import { getChannelOptions } from "@softure-ai/analytics/server";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

describe("the analytics module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(analytics));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(analytics.manifest.version).toBe(manifest.version);
  });

  it("has no database schema and no migrations yet", () => {
    expect(analytics().migrations).toBeNull();
    expect(analytics.manifest.dbSchema).toBeNull();
  });

  it("fills in the defaults: ?z=, lowercase words, at most 32 characters", () => {
    expect(analytics().options).toEqual({ channel: { param: "z", pattern: DEFAULT_CHANNEL_PATTERN, maxLength: 32 } });
    expect(analytics({ channel: { param: "ref" } }).options.channel).toEqual({ param: "ref", pattern: DEFAULT_CHANNEL_PATTERN, maxLength: 32 });
  });

  it("refuses a parameter, pattern or length it cannot use, listing every problem", () => {
    expect(() => analytics({ channel: { param: "Ref", pattern: /^[a-z]+$/g, maxLength: 65 } })).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        "- options.channel.param: must be lowercase letters, digits, - or _, starting with a letter, at most 32 characters",
        "- options.channel.pattern: must not use the g or y flag",
        "- options.channel.maxLength: must be at most 64",
      ].join("\n"),
    );
    expect(() => analytics({ channel: { pattern: /^[a-z]+$/y } })).toThrow("- options.channel.pattern: must not use the g or y flag");
    expect(() => analytics({ channel: { maxLength: 0 } })).toThrow("- options.channel.maxLength:");
    // @ts-expect-error -- a string is not a pattern
    expect(() => analytics({ channel: { pattern: "^[a-z]+$" } })).toThrow("- options.channel.pattern: must be a RegExp");
    // @ts-expect-error -- unknown keys are typos
    expect(() => analytics({ chanel: {} })).toThrow("options");
  });

  it("tells the app to enable the module when it reads options without it", () => {
    const config = { ...createConfig(), modules: [] };
    expect(() => getChannelOptions(config)).toThrow("@softure-ai/analytics: the module is not enabled; add analytics() to modules in softure.config.ts");
  });
});
