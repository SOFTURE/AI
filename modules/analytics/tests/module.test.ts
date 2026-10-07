// The module definition: its manifest, its options and their defaults, its health check.
import { readFileSync } from "node:fs";
import { analytics, DEFAULT_CHANNEL_CAP, DEFAULT_CHANNEL_PATTERN } from "@softure-ai/analytics";
import { ok, toModuleJson } from "@softure-ai/core";
import { getChannelOptions } from "@softure-ai/analytics/server";
import { describe, expect, it } from "vitest";
import { createConfig, createTestFunnel } from "./support.js";

describe("the analytics module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(analytics));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(analytics.manifest.version).toBe(manifest.version);
  });

  it("owns the analytics schema with the funnel table, its migrations and a health check", async () => {
    expect(analytics.manifest.dbSchema).toBe("analytics");
    expect(analytics.manifest.tables).toEqual(["funnel_counts"]);
    expect(analytics().migrations?.dir.href).toMatch(/\/modules\/analytics\/migrations\/$/);
    const test = await createTestFunnel();
    try {
      expect(await analytics().health?.({ db: test.database.db, clock: test.clock, config: test.ctx.config })).toEqual(ok());
    } finally {
      await test.database.close();
    }
  });

  it("fills in the defaults: ?z=, lowercase words, at most 32 characters, no steps, a cap of 100", () => {
    expect(analytics().options).toEqual({
      origins: [],
      channel: { param: "z", pattern: DEFAULT_CHANNEL_PATTERN, maxLength: 32, normalize: "none" },
      funnel: { steps: [], channelCap: DEFAULT_CHANNEL_CAP, wire: { stepFields: ["step"], channelField: null } },
    });
    expect(analytics({ funnel: { steps: [{ id: "landing" }] } }).options.funnel.steps).toEqual([{ id: "landing", via: "beacon" }]);
    expect(analytics({ channel: { param: "ref" } }).options.channel).toEqual({ param: "ref", pattern: DEFAULT_CHANNEL_PATTERN, maxLength: 32, normalize: "none" });
  });

  it("refuses a wire format, normalisation or Referer hook it cannot use", () => {
    expect(() =>
      analytics({
        channel: { normalize: "upper" as "none" },
        funnel: { channelFromReferer: "blog" as unknown as () => null },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        '- options.channel.normalize: Invalid option: expected one of "none"|"trim-lowercase"',
        '- options.funnel.channelFromReferer: must be a function (page: URL) => string | null',
      ].join("\n"),
    );
    expect(() => analytics({ funnel: { wire: { stepFields: ["k", "k"], channelField: "k" } } })).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        '- options.funnel.wire.stepFields.1: "k" is listed twice',
        '- options.funnel.wire.channelField: "k" already names the step',
      ].join("\n"),
    );
    expect(() => analytics({ funnel: { wire: { stepFields: [] } } })).toThrow("options.funnel.wire.stepFields: needs at least one field");
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

  it("refuses steps and caps it cannot count, and a pattern that accepts the overflow key", () => {
    expect(() =>
      analytics({
        funnel: {
          steps: [{ id: "Landing" }, { id: "signup", via: "server" }, { id: "signup" }, { id: "x".repeat(33) }],
          channelCap: 0,
        },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        "- options.funnel.steps.0.id: must be kebab-case, e.g. pricing-page",
        "- options.funnel.steps.3.id: must be at most 32 characters",
        "- options.funnel.channelCap: Too small: expected number to be >=1",
      ].join("\n"),
    );
    expect(() => analytics({ funnel: { steps: [{ id: "signup", via: "server" }, { id: "signup" }] } })).toThrow('- options.funnel.steps.1.id: "signup" is listed twice');
    // @ts-expect-error -- not a way to count a step
    expect(() => analytics({ funnel: { steps: [{ id: "landing", via: "cookie" }] } })).toThrow("- options.funnel.steps.0.via:");
    expect(() => analytics({ channel: { pattern: /^.+$/ } })).toThrow('- options.channel.pattern: must not accept "~overflow", the funnel\'s overflow key');
  });

  it("tells the app to enable the module when it reads options without it", () => {
    const config = { ...createConfig(), modules: [] };
    expect(() => getChannelOptions(config)).toThrow("@softure-ai/analytics: the module is not enabled; add analytics() to modules in softure.config.ts");
  });
});
