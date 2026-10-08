// Options of the gate: severity overrides, rule plugins and their failures, the rule catalog for the
// writing skill, and the options it refuses.
import { readFileSync } from "node:fs";
import { blog } from "@softure-ai/blog";
import { checkArticleText, getQualitySettings, listQualityRules, qualityOptionsSchema, resolveQualitySettings, type BlockPlugin, type QualityOptionsInput, type QualityPlugin } from "@softure-ai/blog/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { seo } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";
import { createConfig } from "../support.js";

const MODEL = readFileSync(new URL("./fixtures/index-funds.txt", import.meta.url), "utf8");

function settingsOf(options: QualityOptionsInput) {
  return resolveQualitySettings(qualityOptionsSchema.parse({ limits: { words: { article: { min: 150 } } }, ...options }), { appOrigin: "https://example.com", timezone: "UTC" });
}

function check(options: QualityOptionsInput, text = MODEL) {
  return checkArticleText({ text, fileName: "index-funds.md", settings: settingsOf(options), today: "2026-10-03" }).findings;
}

const shout: QualityPlugin = {
  name: "shout",
  rules: [{ id: "no-fees-word", severity: "warning", description: "the word fee is avoided" }],
  check: ({ blocks }) => blocks.filter((block) => block.text.includes("fee")).map((block) => ({ rule: "no-fees-word", severity: "warning", message: "says fee", line: block.line })),
};

describe("severity overrides", () => {
  it("raises, lowers and switches off a rule", () => {
    const text = MODEL.replace("Rarely.", "Rarely!");
    expect(check({}, text)).toEqual([expect.objectContaining({ rule: "exclamation", severity: "warning" })]);
    expect(check({ severity: { exclamation: "error" } }, text)).toEqual([expect.objectContaining({ rule: "exclamation", severity: "error" })]);
    expect(check({ severity: { exclamation: "off" } }, text)).toEqual([]);
  });
});

describe("rule plugins", () => {
  it("adds the plugin's findings, which overrides also reach", () => {
    expect(check({ plugins: [shout] }).length).toBeGreaterThan(0);
    expect(check({ plugins: [shout], severity: { "no-fees-word": "off" } })).toEqual([]);
  });

  it("refuses a finding of a rule the plugin does not declare", () => {
    const sloppy: QualityPlugin = { ...shout, rules: [] };
    expect(check({ plugins: [sloppy] })[0]).toEqual({ rule: "plugin-rule-undeclared", severity: "error", message: "plugin shout reported rule no-fees-word, which it does not declare", line: 18 });
  });

  it("turns a throwing plugin into an error finding instead of crashing", () => {
    const broken: QualityPlugin = { ...shout, check: () => { throw new Error("table missing"); } };
    expect(check({ plugins: [broken] })).toEqual([{ rule: "plugin-failed", severity: "error", message: "plugin shout failed: table missing" }]);
  });
});

const chart: BlockPlugin = { type: "chart", requires: ["current_as_of", "scenario"], render: () => ({ kind: "html", html: "" }) };
const WITH_CHART = MODEL.replace("## What does an index fund charge?", "```chart wealth\nwealth over 20 years\n```\n\n## What does an index fund charge?");

describe("block plugins", () => {
  it("reports a block whose frontmatter key is missing, at the line of its fence", () => {
    expect(check({ blocks: [chart] }, WITH_CHART)).toEqual([{ rule: "block-requires", severity: "error", message: "the chart block needs scenario in the frontmatter", line: 20 }]);
    expect(check({}, WITH_CHART)).toEqual([]);
  });

  it("hands the plugin blocks to rule plugins", () => {
    const seen: string[] = [];
    const spy: QualityPlugin = { name: "spy", rules: [], check: ({ pluginBlocks }) => { seen.push(...pluginBlocks.map((block) => `${block.type}:${block.line}`)); return []; } };
    check({ blocks: [chart], plugins: [spy], severity: { "block-requires": "off" } }, WITH_CHART);
    expect(seen).toEqual(["chart:20"]);
  });
});

describe("listQualityRules", () => {
  it("lists the rules of the settings with their effective severity", () => {
    const ids = (options: QualityOptionsInput) => listQualityRules(settingsOf(options)).map((rule) => rule.id);
    expect(ids({})).toContain("crucial");
    expect(ids({})).not.toContain("profit-promise");
    expect(ids({})).not.toContain("title-case-heading");
    expect(ids({ language: "pl" })).toContain("title-case-heading");
    expect(ids({ ymyl: true })).toContain("number-source");
    expect(ids({ voice: { forbidFirstPersonSingular: true } })).toContain("first-person-singular");
    expect(ids({ plugins: [shout] })).toEqual(expect.arrayContaining(["no-fees-word", "plugin-failed"]));
    expect(ids({})).not.toContain("block-requires");
    expect(ids({ blocks: [chart] })).toContain("block-requires");
    expect(ids({ severity: { crucial: "off" } })).not.toContain("crucial");
    expect(listQualityRules(settingsOf({ severity: { stale: "error" } })).find((rule) => rule.id === "stale")?.severity).toBe("error");
  });

  it("names every rule once", () => {
    const ids = listQualityRules(settingsOf({ language: "pl", ymyl: true, voice: { forbidFirstPersonSingular: true }, plugins: [shout] })).map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("blog({ quality })", () => {
  it("takes false to turn the gate off", () => {
    expect(blog({ quality: false }).options.quality).toBe(false);
  });

  it("refuses options it cannot use", () => {
    expect(() =>
      blog({
        quality: {
          // @ts-expect-error: no such ruleset.
          language: "de",
          voice: { phrases: [{ id: "bad", pattern: /once/i, message: "x" }] },
          limits: { words: { article: { min: 900, max: 800 } } },
          // @ts-expect-error: a plugin needs rules and check.
          plugins: [{ name: "half" }],
        },
      }),
    ).toThrow(/quality\.language[\s\S]*must be global[\s\S]*min must not exceed max[\s\S]*must be a plugin/);
  });
});

describe("paths of articles and terms", () => {
  const withRoutes = (quality: QualityOptionsInput = {}) =>
    defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "UTC",
      appOrigin: "https://app.example.com",
      modules: [blog({ routes: { index: "/articles/", glossary: "/dictionary" }, quality })],
    });

  it("follows the blog's routes when quality.paths is not set", () => {
    expect(getQualitySettings(withRoutes())?.paths).toEqual({ articles: "/articles", terms: "/dictionary" });
  });

  it("lets quality.paths override each route on its own", () => {
    expect(getQualitySettings(withRoutes({ paths: { terms: "/glossary/" } }))?.paths).toEqual({ articles: "/articles", terms: "/glossary" });
    expect(getQualitySettings(withRoutes({ paths: { articles: "/texts", terms: "/words" } }))?.paths).toEqual({ articles: "/texts", terms: "/words" });
  });

  it("gives the module's default routes to a caller without routes", () => {
    expect(resolveQualitySettings(qualityOptionsSchema.parse({}), { appOrigin: "https://example.com", timezone: "UTC" }).paths).toEqual({ articles: "/blog", terms: "/blog/glossary" });
  });
});

describe("own origins", () => {
  it("adds the site origin to appOrigin and ownOrigins, once", () => {
    const options = qualityOptionsSchema.parse({ ownOrigins: ["https://www.example.com", "https://example.org"] });
    expect(resolveQualitySettings(options, { appOrigin: "https://app.example.com", siteOrigin: "https://example.org", timezone: "UTC" }).ownOrigins).toEqual([
      "https://app.example.com",
      "https://example.org",
      "https://www.example.com",
    ]);
  });

  // seo's canonical host (example.org) differs from appOrigin (https://app.example.com).
  const config = createConfig({ quality: { limits: { words: { article: { min: 150 } } } } }, [seo({ origin: "https://www.example.org", canonical: { host: "apex" } })]);

  it("counts a link to seo's canonical origin as internal without the app listing it", () => {
    const settings = getQualitySettings(config);
    expect(settings?.ownOrigins).toEqual(["https://app.example.com", "https://example.org"]);
    if (settings === null) return;
    const text = MODEL.replace("[savings calculator](/calculator)", "[savings calculator](https://example.org/nowhere)");
    const result = checkArticleText({ text, fileName: "index-funds.md", settings, today: "2026-10-03", resolveInternalLink: (path) => path !== "/nowhere" });
    expect(result.findings).toEqual([{ rule: "internal-link-target", severity: "error", message: "an internal link leads nowhere: /nowhere", line: 30 }]);
  });

  it("keeps the site's origin alone without seo", () => {
    expect(getQualitySettings(createConfig())?.ownOrigins).toEqual(["https://app.example.com"]);
  });
});

const chartDirective: BlockPlugin = { type: "chart", syntax: "directive", requires: ["scenario"], render: () => ({ kind: "html", html: "" }) };
const withDirective = (line: string) => MODEL.replace("## What does an index fund charge?", `${line}\n\n## What does an index fund charge?`);

describe("directive plugins", () => {
  it("reports a directive whose frontmatter key is missing, at its line", () => {
    expect(check({ blocks: [chartDirective] }, withDirective('::chart{type="wealth"}'))).toEqual([
      { rule: "block-requires", severity: "error", message: "the chart block needs scenario in the frontmatter", line: 20 },
    ]);
  });

  it("reports an unknown directive and one whose attributes cannot be read", () => {
    const options = { blocks: [chartDirective], severity: { "block-requires": "off" as const } };
    expect(check(options, withDirective('::chrat{type="wealth"}'))).toEqual([
      { rule: "block-directive", severity: "error", message: "::chrat is not a directive this blog renders; use one of: chart", line: 20 },
    ]);
    expect(check(options, withDirective("::chart{type=wealth}"))).toEqual([
      { rule: "block-directive", severity: "error", message: 'the attributes of ::chart cannot be read; write them as key="value" pairs, each key once', line: 20 },
    ]);
  });

  it("checks no directive without directive plugins", () => {
    expect(check({ blocks: [chart] }, withDirective('::chrat{type="wealth"}'))).toEqual([]);
    const ids = (options: QualityOptionsInput) => listQualityRules(settingsOf(options)).map((rule) => rule.id);
    expect(ids({ blocks: [chart] })).not.toContain("block-directive");
    expect(ids({ blocks: [chartDirective] })).toContain("block-directive");
  });
});
